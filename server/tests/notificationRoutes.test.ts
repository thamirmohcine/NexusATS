import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createCandidateRepository } from "../src/candidateRepository.js";
import { initializeDatabase } from "../src/databaseSchema.js";
import type { Notification } from "../src/db.js";
import { createNotificationRepository } from "../src/notificationRepository.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createCandidatesRouter } from "../src/routes/candidates.js";
import { createChatRouter } from "../src/routes/chat.js";
import { createNotificationsRouter } from "../src/routes/notifications.js";
import type { ResumeAnalysis } from "../src/services/ai.js";
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
  candidates: ReturnType<typeof createCandidateRepository>;
  database: Database.Database;
  server: TestServer;
}

const jwtSecret = "test-secret";

const analysis: ResumeAnalysis = {
  candidateName: "Updated Candidate",
  email: "updated@example.com",
  phone: null,
  linkedin: null,
  github: null,
  skills: ["TypeScript", "Node.js"],
  experience: [],
  projects: [],
  summary: {
    en: "Updated profile summary.",
    fr: "Resume de profil mis a jour.",
    ar: "ملخص ملف محدث.",
  },
  score: 91,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNotification = (value: unknown): value is Notification =>
  isRecord(value) &&
  typeof value.id === "number" &&
  (typeof value.user_id === "number" || value.user_id === null) &&
  (typeof value.target_role === "string" || value.target_role === null) &&
  (typeof value.candidate_id === "number" || value.candidate_id === null) &&
  (typeof value.sender_id === "number" || value.sender_id === null) &&
  typeof value.type === "string" &&
  typeof value.title === "string" &&
  typeof value.content === "string" &&
  typeof value.is_read === "number" &&
  typeof value.created_at === "string";

const isNotificationArray = (value: unknown): value is Notification[] =>
  Array.isArray(value) && value.every(isNotification);

const startServer = async (): Promise<TestContext> => {
  const database = new Database(":memory:");
  const uploadsDirectory = await mkdtemp(
    join(tmpdir(), "notification-route-uploads-"),
  );
  initializeDatabase(database);

  const users = createUserRepository(database);
  const candidates = createCandidateRepository(database);
  const notifications = createNotificationRepository(database);
  const app = express();

  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      jwtSecret,
      userRepository: users,
    }),
  );
  app.use(
    "/api/candidates",
    createCandidatesRouter({
      jwtSecret,
      candidateRepository: candidates,
      userRepository: users,
      analyzeResumeService: async () => analysis,
      extractPdfTextService: async () => "Resume text from PDF",
      notificationRepository: notifications,
      uploadsDirectory,
    }),
  );
  app.use(
    "/api/chat",
    createChatRouter({
      jwtSecret,
      database,
      userRepository: users,
      candidateRepository: candidates,
      notificationRepository: notifications,
    }),
  );
  app.use(
    "/api/notifications",
    createNotificationsRouter({
      jwtSecret,
      userRepository: users,
      notificationRepository: notifications,
    }),
  );

  const listener = app.listen(0);
  await once(listener, "listening");

  const address = listener.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");

  return {
    candidates,
    database,
    server: {
      baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
      close: async () => {
        await new Promise<void>((resolve, reject) => {
          listener.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
        await rm(uploadsDirectory, { force: true, recursive: true });
      },
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
  assert.equal(typeof body.token, "string");
  assert.ok(isRecord(body.user));
  assert.equal(typeof body.user.id, "number");

  return {
    id: body.user.id,
    token: body.token,
  };
};

const getNotifications = async (
  baseUrl: string,
  token: string,
): Promise<{ status: number; notifications: Notification[] }> => {
  const response = await fetch(`${baseUrl}/api/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body: unknown = await response.json();

  assert.ok(isNotificationArray(body));

  return {
    status: response.status,
    notifications: body,
  };
};

test("notifications route returns application notifications to admins and marks them read", async () => {
  const { database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin User",
      email: "notifications-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate User",
      email: "notifications-candidate@example.com",
      password: "secret",
      role: "candidate",
    });

    const analyzeResponse = await postJson(
      `${server.baseUrl}/api/candidates/analyze`,
      { resumeText: "Candidate resume text" },
      candidateUser.token,
    );

    assert.equal(analyzeResponse.status, 201);

    const candidateNotifications = await getNotifications(
      server.baseUrl,
      candidateUser.token,
    );
    const adminNotifications = await getNotifications(
      server.baseUrl,
      admin.token,
    );

    assert.equal(candidateNotifications.status, 200);
    assert.equal(candidateNotifications.notifications.length, 0);
    assert.equal(adminNotifications.status, 200);
    assert.equal(adminNotifications.notifications.length, 1);
    assert.equal(adminNotifications.notifications[0]?.target_role, "admin");
    assert.equal(adminNotifications.notifications[0]?.type, "candidate_application");
    assert.equal(adminNotifications.notifications[0]?.title, "New candidate application");
    assert.equal(typeof adminNotifications.notifications[0]?.candidate_id, "number");
    assert.equal(adminNotifications.notifications[0]?.sender_id, candidateUser.id);
    assert.equal(
      adminNotifications.notifications[0]?.content,
      "Updated Candidate submitted a resume.",
    );

    const readResponse = await fetch(
      `${server.baseUrl}/api/notifications/read-all`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${admin.token}`,
        },
      },
    );
    const readBody: unknown = await readResponse.json();

    assert.equal(readResponse.status, 200);
    assert.deepEqual(readBody, { message: "Notifications marked as read" });
    assert.equal(
      (await getNotifications(server.baseUrl, admin.token)).notifications
        .length,
      0,
    );
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate PDF uploads create unread admin notifications", async () => {
  const { database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "PDF Admin",
      email: "notifications-pdf-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "PDF Candidate",
      email: "notifications-pdf-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const formData = new FormData();
    formData.append(
      "file",
      new File(["PDF content"], "resume.pdf", { type: "application/pdf" }),
    );

    const uploadResponse = await fetch(
      `${server.baseUrl}/api/candidates/upload-pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${candidateUser.token}`,
        },
        body: formData,
      },
    );

    assert.equal(uploadResponse.status, 201);

    const adminNotifications = await getNotifications(
      server.baseUrl,
      admin.token,
    );

    assert.equal(adminNotifications.notifications.length, 1);
    assert.equal(adminNotifications.notifications[0]?.type, "candidate_application");
    assert.equal(adminNotifications.notifications[0]?.target_role, "admin");
    assert.equal(typeof adminNotifications.notifications[0]?.candidate_id, "number");
    assert.equal(adminNotifications.notifications[0]?.sender_id, candidateUser.id);
  } finally {
    await server.close();
    database.close();
  }
});

test("notifications route marks one clicked notification as read", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Single Read Admin",
      email: "single-read-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Single Read Candidate",
      email: "single-read-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const candidate = candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Single Read Candidate Profile",
      email: "single-read-profile@example.com",
      skills: JSON.stringify(["TypeScript"]),
      summary: "Profile summary.",
      score: 88,
    });

    assert.notEqual(candidate, undefined);

    assert.equal(
      (
        await postJson(
          `${server.baseUrl}/api/chat/send`,
          {
            receiver_id: admin.id,
            candidate_id: candidate?.id ?? 0,
            content: "First unread message.",
          },
          candidateUser.token,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await postJson(
          `${server.baseUrl}/api/chat/send`,
          {
            receiver_id: admin.id,
            candidate_id: candidate?.id ?? 0,
            content: "Second unread message.",
          },
          candidateUser.token,
        )
      ).status,
      201,
    );

    const beforeRead = await getNotifications(server.baseUrl, admin.token);
    const clickedNotificationId = beforeRead.notifications[0]?.id ?? 0;

    const readResponse = await fetch(
      `${server.baseUrl}/api/notifications/${clickedNotificationId}/read`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${admin.token}`,
        },
      },
    );
    const readBody: unknown = await readResponse.json();
    const afterRead = await getNotifications(server.baseUrl, admin.token);

    assert.equal(readResponse.status, 200);
    assert.deepEqual(readBody, { message: "Notification marked as read" });
    assert.equal(afterRead.notifications.length, 1);
    assert.notEqual(afterRead.notifications[0]?.id, clickedNotificationId);
  } finally {
    await server.close();
    database.close();
  }
});

test("chat sends admin-role and direct user notifications", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Chat Admin",
      email: "notifications-chat-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Chat Candidate",
      email: "notifications-chat-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const candidate = candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Chat Candidate Profile",
      email: "chat-profile@example.com",
      skills: JSON.stringify(["TypeScript"]),
      summary: "Profile summary.",
      score: 88,
    });

    assert.notEqual(candidate, undefined);

    const candidateMessageResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: admin.id,
        candidate_id: candidate?.id ?? 0,
        content: "Hello admin.",
      },
      candidateUser.token,
    );

    assert.equal(candidateMessageResponse.status, 201);

    const adminNotifications = await getNotifications(
      server.baseUrl,
      admin.token,
    );

    assert.equal(adminNotifications.notifications.length, 1);
    assert.equal(adminNotifications.notifications[0]?.target_role, "admin");
    assert.equal(adminNotifications.notifications[0]?.type, "message");
    assert.equal(adminNotifications.notifications[0]?.title, "New message");
    assert.equal(adminNotifications.notifications[0]?.candidate_id, candidate?.id);
    assert.equal(adminNotifications.notifications[0]?.sender_id, candidateUser.id);
    assert.equal(
      adminNotifications.notifications[0]?.content,
      "Chat Candidate sent a message.",
    );

    const adminMessageResponse = await postJson(
      `${server.baseUrl}/api/chat/send`,
      {
        receiver_id: candidateUser.id,
        candidate_id: candidate?.id ?? 0,
        content: "Thanks for the update.",
      },
      admin.token,
    );

    assert.equal(adminMessageResponse.status, 201);

    const candidateNotifications = await getNotifications(
      server.baseUrl,
      candidateUser.token,
    );

    assert.equal(candidateNotifications.notifications.length, 1);
    assert.equal(candidateNotifications.notifications[0]?.user_id, candidateUser.id);
    assert.equal(candidateNotifications.notifications[0]?.target_role, null);
    assert.equal(candidateNotifications.notifications[0]?.type, "message");
    assert.equal(candidateNotifications.notifications[0]?.candidate_id, candidate?.id);
    assert.equal(candidateNotifications.notifications[0]?.sender_id, admin.id);
    assert.equal(
      candidateNotifications.notifications[0]?.content,
      "Chat Admin sent a message.",
    );
  } finally {
    await server.close();
    database.close();
  }
});
