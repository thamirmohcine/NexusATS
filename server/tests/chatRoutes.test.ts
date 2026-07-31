import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createCandidateRepository } from "../src/candidateRepository.js";
import { initializeDatabase } from "../src/databaseSchema.js";
import type { Message } from "../src/db.js";
import { createGlobalErrorHandler } from "../src/middleware/errorHandler.js";
import { createLogger } from "../src/services/logger.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createChatRouter } from "../src/routes/chat.js";
import { createUserRepository } from "../src/userRepository.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

interface AuthenticatedTestUser {
  id: number;
  token: string;
}

interface TestContext {
  database: Database.Database;
  candidates: ReturnType<typeof createCandidateRepository>;
  server: TestServer;
}

const jwtSecret = "test-secret";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMessage = (value: unknown): value is Message =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.sender_id === "number" &&
  typeof value.receiver_id === "number" &&
  typeof value.candidate_id === "number" &&
  typeof value.content === "string" &&
  (value.is_read === 0 || value.is_read === 1) &&
  typeof value.created_at === "string";

const isMessageArray = (value: unknown): value is Message[] =>
  Array.isArray(value) && value.every(isMessage);

const seedCandidate = (
  database: Database.Database,
  opts: { user_id: number | null; name: string; email: string },
): { id: number } => {
  const repo = createCandidateRepository(database);
  const candidate = repo.findOrCreateCandidate({
    user_id: opts.user_id,
    name: opts.name,
    email: opts.email,
  });

  const resume = repo.insertResume({
    candidate_id: candidate.id,
    pdf_url: null,
  });
  if (resume) {
    repo.insertResumeAnalysis({
      resume_id: resume.id,
      skills: JSON.stringify(["TypeScript"]),
      experience: null,
      projects: null,
      summary: "Profile summary.",
      score: 88,
    });
  }

  return { id: candidate.id };
};

const startServer = async (): Promise<TestContext> => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const users = createUserRepository(database);
  const candidates = createCandidateRepository(database);
  const app = express();

  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      jwtSecret,
      database,
      userRepository: users,
    }),
  );
  app.use(
    "/api/chat",
    createChatRouter({
      jwtSecret,
      database,
      userRepository: users,
      candidateRepository: candidates,
    }),
  );
  app.use(createGlobalErrorHandler(createLogger({ level: "error" })));

  const listener = app.listen(0);
  await once(listener, "listening");

  const address = listener.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");

  return {
    database,
    candidates,
    server: {
      baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
      close: () =>
        new Promise<void>((resolve, reject) => {
          listener.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    },
  };
};

const postJson = (
  url: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<Response> =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

const registerUser = async (
  baseUrl: string,
  input: {
    name: string;
    email: string;
    password: string;
    role: "candidate" | "admin";
  },
): Promise<AuthenticatedTestUser> => {
  const response = await postJson(`${baseUrl}/api/auth/register`, input);
  const body: unknown = await response.json();

  assert.equal(response.status, 201);
  assert.ok(isRecord(body));
  assert.equal(typeof body.accessToken, "string");
  assert.equal(typeof body.refreshToken, "string");
  assert.ok(isRecord(body.user));
  assert.equal(typeof body.user.id, "number");

  return {
    id: body.user.id,
    token: body.accessToken,
  };
};

const getMessages = async (
  baseUrl: string,
  candidateId: number,
  token: string,
): Promise<{ status: number; messages: Message[] }> => {
  const response = await fetch(`${baseUrl}/api/chat/${candidateId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body: unknown = await response.json();

  assert.ok(isMessageArray(body));

  return {
    status: response.status,
    messages: body,
  };
};

test("chat routes send and fetch candidate-admin messages in chronological order", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin User",
      email: "chat-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate User",
      email: "chat-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const candidate = seedCandidate(database, {
      user_id: candidateUser.id,
      name: "Candidate Profile",
      email: "profile@example.com",
    });

    const firstResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: admin.id,
        candidate_id: candidate.id,
        content: "Hello admin, I uploaded my resume.",
      },
      candidateUser.token,
    );
    const firstBody: unknown = await firstResponse.json();

    assert.equal(firstResponse.status, 201);
    assert.ok(isMessage(firstBody));
    assert.equal(firstBody.sender_id, candidateUser.id);
    assert.equal(firstBody.receiver_id, admin.id);
    assert.equal(firstBody.candidate_id, candidate.id);
    assert.equal(firstBody.is_read, 0);

    const secondResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: candidateUser.id,
        candidate_id: candidate.id,
        content: "Thanks, I reviewed it.",
      },
      admin.token,
    );

    assert.equal(secondResponse.status, 201);

    const candidateMessages = await getMessages(
      server.baseUrl,
      candidate.id,
      candidateUser.token,
    );
    const adminMessages = await getMessages(
      server.baseUrl,
      candidate.id,
      admin.token,
    );

    assert.equal(candidateMessages.status, 200);
    assert.deepEqual(
      candidateMessages.messages.map((message) => message.content),
      ["Hello admin, I uploaded my resume.", "Thanks, I reviewed it."],
    );
    assert.deepEqual(
      adminMessages.messages.map((message) => message.content),
      ["Hello admin, I uploaded my resume.", "Thanks, I reviewed it."],
    );
    assert.deepEqual(
      candidateMessages.messages.map((message) => message.is_read),
      [0, 1],
    );
    assert.deepEqual(
      adminMessages.messages.map((message) => message.is_read),
      [1, 1],
    );
  } finally {
    await server.close();
    database.close();
  }
});

test("chat routes mark only messages sent to the current user as read", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Seen Admin",
      email: "seen-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Seen Candidate",
      email: "seen-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const candidate = seedCandidate(database, {
      user_id: candidateUser.id,
      name: "Seen Candidate Profile",
      email: "seen-profile@example.com",
    });

    const candidateMessageResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: admin.id,
        candidate_id: candidate.id,
        content: "Candidate to admin.",
      },
      candidateUser.token,
    );
    const candidateMessageBody: unknown = await candidateMessageResponse.json();

    assert.equal(candidateMessageResponse.status, 201);
    assert.ok(isMessage(candidateMessageBody));
    assert.equal(candidateMessageBody.is_read, 0);

    const adminMessages = await getMessages(
      server.baseUrl,
      candidate.id,
      admin.token,
    );

    assert.equal(adminMessages.status, 200);
    assert.deepEqual(
      adminMessages.messages.map((message) => message.is_read),
      [1],
    );

    const adminMessageResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: candidateUser.id,
        candidate_id: candidate.id,
        content: "Admin to candidate.",
      },
      admin.token,
    );
    const adminMessageBody: unknown = await adminMessageResponse.json();

    assert.equal(adminMessageResponse.status, 201);
    assert.ok(isMessage(adminMessageBody));
    assert.equal(adminMessageBody.is_read, 0);

    const adminViewBeforeCandidateReads = await getMessages(
      server.baseUrl,
      candidate.id,
      admin.token,
    );

    assert.deepEqual(
      adminViewBeforeCandidateReads.messages.map((message) => message.is_read),
      [1, 0],
    );

    const candidateMessages = await getMessages(
      server.baseUrl,
      candidate.id,
      candidateUser.token,
    );

    assert.deepEqual(
      candidateMessages.messages.map((message) => message.is_read),
      [1, 1],
    );
  } finally {
    await server.close();
    database.close();
  }
});

test("chat routes prevent candidates from accessing another candidate profile chat", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin User",
      email: "chat-admin-owned@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Owner",
      email: "chat-owner@example.com",
      password: "secret",
      role: "candidate",
    });
    const otherCandidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Other",
      email: "chat-other@example.com",
      password: "secret",
      role: "candidate",
    });
    const candidate = seedCandidate(database, {
      user_id: candidateUser.id,
      name: "Owned Chat Profile",
      email: "owned-chat-profile@example.com",
    });

    const forbiddenSendResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: admin.id,
        candidate_id: candidate.id,
        content: "I should not reach this conversation.",
      },
      otherCandidateUser.token,
    );
    const forbiddenSendBody: unknown = await forbiddenSendResponse.json();

    assert.equal(forbiddenSendResponse.status, 404);
    assert.deepEqual(forbiddenSendBody, { error: "Candidate not found" });

    const forbiddenReadResponse = await fetch(
      `${server.baseUrl}/api/chat/${candidate.id}`,
      {
        headers: {
          Authorization: `Bearer ${otherCandidateUser.token}`,
        },
      },
    );
    const forbiddenReadBody: unknown = await forbiddenReadResponse.json();

    assert.equal(forbiddenReadResponse.status, 404);
    assert.deepEqual(forbiddenReadBody, { error: "Candidate not found" });
  } finally {
    await server.close();
    database.close();
  }
});

test("chat routes validate authentication and message input", async () => {
  const { database, server } = await startServer();

  try {
    const missingTokenResponse = await postJson(`${server.baseUrl}/api/chat/send`, {
      receiver_id: 1,
      candidate_id: 1,
      content: "Hello",
    });
    const missingTokenBody: unknown = await missingTokenResponse.json();

    assert.equal(missingTokenResponse.status, 401);
    assert.deepEqual(missingTokenBody, {
      error: "Authorization token is required",
    });
  } finally {
    await server.close();
    database.close();
  }
});
