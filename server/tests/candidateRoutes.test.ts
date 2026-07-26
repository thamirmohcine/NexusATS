import assert from "node:assert/strict";
import { once } from "node:events";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createCandidateRepository } from "../src/candidateRepository.js";
import type { CandidateResponse } from "../src/candidateResponse.js";
import { initializeDatabase } from "../src/databaseSchema.js";
import type { ResumeAnalysis } from "../src/services/ai.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createCandidatesRouter } from "../src/routes/candidates.js";
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
  uploadsDirectory: string;
}

const jwtSecret = "test-secret";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCandidateResponseArray = (
  value: unknown,
): value is CandidateResponse[] =>
  Array.isArray(value) &&
  value.every(
    (candidate) =>
      isRecord(candidate) &&
      typeof candidate.id === "number" &&
      typeof candidate.name === "string",
  );

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

const createResumePdfBuffer = (): Buffer =>
  Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 70 >>
stream
BT /F1 24 Tf 72 720 Td (Maya Chen TypeScript Node.js Resume) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
431
%%EOF`);

const startServer = async (): Promise<TestContext> => {
  const database = new Database(":memory:");
  const uploadsDirectory = await mkdtemp(
    join(tmpdir(), "candidate-route-uploads-"),
  );
  initializeDatabase(database);

  const users = createUserRepository(database);
  const candidates = createCandidateRepository(database);
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
      uploadsDirectory,
    }),
  );

  const listener = app.listen(0);
  await once(listener, "listening");

  const address = listener.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");

  return {
    database,
    candidates,
    uploadsDirectory,
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

const getCandidates = async (
  baseUrl: string,
  token: string,
): Promise<{ status: number; candidates: CandidateResponse[] }> => {
  const response = await fetch(`${baseUrl}/api/candidates`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body: unknown = await response.json();

  assert.ok(isCandidateResponseArray(body));

  return {
    status: response.status,
    candidates: body,
  };
};

test("candidate routes return all candidates to admins and only owned candidates to candidates", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin User",
      email: "admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate One",
      email: "candidate-one@example.com",
      password: "secret",
      role: "candidate",
    });
    const otherCandidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Two",
      email: "candidate-two@example.com",
      password: "secret",
      role: "candidate",
    });

    candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Candidate One Profile",
      email: "one-profile@example.com",
      skills: JSON.stringify(["React"]),
      summary: "One summary.",
      score: 81,
    });
    candidates.upsertCandidate({
      user_id: otherCandidateUser.id,
      name: "Candidate Two Profile",
      email: "two-profile@example.com",
      skills: JSON.stringify(["SQL"]),
      summary: "Two summary.",
      score: 72,
    });

    const adminResult = await getCandidates(server.baseUrl, admin.token);
    const candidateResult = await getCandidates(
      server.baseUrl,
      candidateUser.token,
    );

    assert.equal(adminResult.status, 200);
    assert.deepEqual(
      adminResult.candidates.map((candidate) => candidate.name).sort(),
      ["Candidate One Profile", "Candidate Two Profile"],
    );
    assert.equal(candidateResult.status, 200);
    assert.deepEqual(
      candidateResult.candidates.map((candidate) => candidate.name),
      ["Candidate One Profile"],
    );
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes let candidates delete their own profile while admins can delete any profile", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin User",
      email: "admin-delete@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Owner",
      email: "candidate-owner@example.com",
      password: "secret",
      role: "candidate",
    });
    const otherCandidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Other",
      email: "candidate-other@example.com",
      password: "secret",
      role: "candidate",
    });
    const ownedCandidate = candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Owned Profile",
      email: "owned-profile@example.com",
      skills: JSON.stringify(["React"]),
      summary: "Owned summary.",
      score: 83,
    });
    const otherCandidate = candidates.upsertCandidate({
      user_id: otherCandidateUser.id,
      name: "Other Profile",
      email: "other-profile@example.com",
      skills: JSON.stringify(["SQL"]),
      summary: "Other summary.",
      score: 75,
    });

    assert.notEqual(ownedCandidate, undefined);
    assert.notEqual(otherCandidate, undefined);

    const forbiddenOtherDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${otherCandidate?.id ?? 0}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${candidateUser.token}`,
        },
      },
    );
    const forbiddenOtherDeleteBody: unknown =
      await forbiddenOtherDeleteResponse.json();

    assert.equal(forbiddenOtherDeleteResponse.status, 404);
    assert.deepEqual(forbiddenOtherDeleteBody, { error: "Candidate not found" });
    assert.notEqual(candidates.getCandidateById(otherCandidate?.id ?? 0), undefined);

    const ownDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${ownedCandidate?.id ?? 0}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${candidateUser.token}`,
        },
      },
    );
    const ownDeleteBody: unknown = await ownDeleteResponse.json();

    assert.equal(ownDeleteResponse.status, 200);
    assert.deepEqual(ownDeleteBody, {
      message: "Candidate deleted successfully",
    });
    assert.equal(candidates.getCandidateById(ownedCandidate?.id ?? 0), undefined);

    const adminDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${otherCandidate?.id ?? 0}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${admin.token}`,
        },
      },
    );

    assert.equal(adminDeleteResponse.status, 200);
    assert.equal(candidates.getCandidateById(otherCandidate?.id ?? 0), undefined);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes delete related messages notifications and uploaded PDF files", async () => {
  const { candidates, database, server, uploadsDirectory } =
    await startServer();

  try {
    const admin = await registerUser(server.baseUrl, {
      name: "Admin Cleanup",
      email: "admin-cleanup@example.com",
      password: "secret",
      role: "admin",
    });
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Cleanup",
      email: "candidate-cleanup@example.com",
      password: "secret",
      role: "candidate",
    });
    const pdfFileName = "cleanup-resume.pdf";
    const pdfFilePath = join(uploadsDirectory, pdfFileName);

    await writeFile(pdfFilePath, createResumePdfBuffer());

    const candidate = candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Cleanup Profile",
      email: "cleanup-profile@example.com",
      pdf_url: `${server.baseUrl}/uploads/${pdfFileName}`,
      skills: JSON.stringify(["TypeScript"]),
      summary: "Cleanup summary.",
      score: 88,
    });

    assert.notEqual(candidate, undefined);

    database
      .prepare(
        "INSERT INTO messages (sender_id, receiver_id, candidate_id, content) VALUES (?, ?, ?, ?)",
      )
      .run(candidateUser.id, admin.id, candidate?.id ?? 0, "Hello admin.");
    database
      .prepare(
        "INSERT INTO notifications (user_id, target_role, candidate_id, sender_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        null,
        "admin",
        candidate?.id ?? 0,
        candidateUser.id,
        "candidate_application",
        "New candidate application",
        "Cleanup Profile submitted a resume.",
      );

    const deleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${candidate?.id ?? 0}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${admin.token}`,
        },
      },
    );
    const deleteBody: unknown = await deleteResponse.json();

    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteBody, {
      message: "Candidate deleted successfully",
    });
    assert.equal(candidates.getCandidateById(candidate?.id ?? 0), undefined);
    assert.equal(
      database
        .prepare("SELECT COUNT(*) AS count FROM messages WHERE candidate_id = ?")
        .get(candidate?.id ?? 0)
        ?.count,
      0,
    );
    assert.equal(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM notifications WHERE candidate_id = ?",
        )
        .get(candidate?.id ?? 0)
        ?.count,
      0,
    );
    await assert.rejects(access(pdfFilePath));
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes attach analyzed profiles to the candidate user and replace their existing profile", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Submitter",
      email: "candidate-submit@example.com",
      password: "secret",
      role: "candidate",
    });
    const existingCandidate = candidates.upsertCandidate({
      user_id: candidateUser.id,
      name: "Original Candidate",
      email: "original@example.com",
      skills: JSON.stringify(["React"]),
      summary: "Original summary.",
      score: 70,
    });

    assert.notEqual(existingCandidate, undefined);

    const response = await postJson(
      `${server.baseUrl}/api/candidates/analyze`,
      { resumeText: "Updated resume text" },
      candidateUser.token,
    );
    const body: unknown = await response.json();

    assert.equal(response.status, 201);
    assert.ok(isRecord(body));
    assert.equal(body.id, existingCandidate?.id);
    assert.equal(body.user_id, candidateUser.id);
    assert.equal(body.name, "Updated Candidate");
    assert.equal(candidates.getCandidates().length, 1);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes return conflict when an analyzed profile belongs to another candidate user", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Submitter",
      email: "candidate-submit-conflict@example.com",
      password: "secret",
      role: "candidate",
    });
    const otherCandidateUser = await registerUser(server.baseUrl, {
      name: "Existing Candidate Owner",
      email: "candidate-existing-owner@example.com",
      password: "secret",
      role: "candidate",
    });
    const existingCandidate = candidates.upsertCandidate({
      user_id: otherCandidateUser.id,
      name: "Existing Candidate",
      email: analysis.email,
      skills: JSON.stringify(["React"]),
      summary: "Existing owner summary.",
      score: 70,
    });

    assert.notEqual(existingCandidate, undefined);

    const response = await postJson(
      `${server.baseUrl}/api/candidates/analyze`,
      { resumeText: "Updated resume text" },
      candidateUser.token,
    );
    const body: unknown = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      error: "Candidate profile already belongs to another account",
    });
    assert.equal(candidates.getCandidateById(existingCandidate?.id ?? 0)?.user_id, otherCandidateUser.id);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes upload a PDF resume for a candidate user", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "PDF Candidate",
      email: "pdf-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const formData = new FormData();
    formData.append(
      "file",
      new File([createResumePdfBuffer()], "resume.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await fetch(`${server.baseUrl}/api/candidates/upload-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${candidateUser.token}`,
      },
      body: formData,
    });
    const body: unknown = await response.json();

    assert.equal(response.status, 201);
    assert.ok(isRecord(body));
    assert.equal(body.user_id, candidateUser.id);
    assert.equal(body.name, "Updated Candidate");
    assert.equal(typeof body.pdf_url, "string");
    assert.match(String(body.pdf_url), /\/uploads\/\d+-resume\.pdf$/);
    assert.equal(candidates.getCandidatesByUserId(candidateUser.id).length, 1);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes return conflict when an uploaded PDF profile belongs to another candidate user", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "PDF Candidate Submitter",
      email: "pdf-candidate-conflict@example.com",
      password: "secret",
      role: "candidate",
    });
    const otherCandidateUser = await registerUser(server.baseUrl, {
      name: "PDF Existing Owner",
      email: "pdf-existing-owner@example.com",
      password: "secret",
      role: "candidate",
    });
    const existingCandidate = candidates.upsertCandidate({
      user_id: otherCandidateUser.id,
      name: "Existing PDF Candidate",
      email: analysis.email,
      skills: JSON.stringify(["React"]),
      summary: "Existing PDF owner summary.",
      score: 70,
    });
    const formData = new FormData();

    assert.notEqual(existingCandidate, undefined);
    formData.append(
      "file",
      new File([createResumePdfBuffer()], "resume.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await fetch(`${server.baseUrl}/api/candidates/upload-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${candidateUser.token}`,
      },
      body: formData,
    });
    const body: unknown = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      error: "Candidate profile already belongs to another account",
    });
    assert.equal(candidates.getCandidateById(existingCandidate?.id ?? 0)?.user_id, otherCandidateUser.id);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes upload a PDF resume by linking an existing same-email profile", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "PDF Candidate Owner",
      email: "pdf-owner@example.com",
      password: "secret",
      role: "candidate",
    });
    const existingCandidate = candidates.upsertCandidate({
      user_id: null,
      name: "Legacy PDF Candidate",
      email: analysis.email,
      skills: JSON.stringify(["React"]),
      summary: "Legacy profile.",
      score: 70,
    });
    const formData = new FormData();
    formData.append(
      "file",
      new File([createResumePdfBuffer()], "resume.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await fetch(`${server.baseUrl}/api/candidates/upload-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${candidateUser.token}`,
      },
      body: formData,
    });
    const body: unknown = await response.json();

    assert.equal(response.status, 201);
    assert.ok(isRecord(body));
    assert.equal(body.id, existingCandidate?.id);
    assert.equal(body.user_id, candidateUser.id);
    assert.equal(body.name, "Updated Candidate");
    assert.equal(candidates.getCandidates().length, 1);
  } finally {
    await server.close();
    database.close();
  }
});

test("candidate routes reject unauthenticated candidate requests", async () => {
  const { database, server } = await startServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/candidates`);
    const body: unknown = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: "Authorization token is required" });
  } finally {
    await server.close();
    database.close();
  }
});
