import assert from "node:assert/strict";
import { once } from "node:events";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Pool } from "pg";
import express from "express";

import { createCandidateRepository } from "../src/candidateRepository.js";
import type { CandidateResponse } from "../src/candidateResponse.js";
import { createGlobalErrorHandler } from "../src/middleware/errorHandler.js";
import { createLogger } from "../src/services/logger.js";
import { createNotificationRepository } from "../src/notificationRepository.js";
import type { ResumeAnalysis } from "../src/services/ai.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createCandidatesRouter } from "../src/routes/candidates.js";
import { createUserRepository } from "../src/userRepository.js";
import { closeTestDatabase, createTestDatabase } from "../src/__tests__/helpers/testDatabase.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

interface AuthenticatedTestUser {
  id: number;
  token: string;
}

interface TestContext {
  database: Pool;
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
1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 70 >>\nstream\nBT /F1 24 Tf 72 720 Td (Maya Chen TypeScript Node.js Resume) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000311 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n431\n%%EOF`);

/**
 * Seed a candidate + resume + analysis directly through the repository,
 * bypassing the mock analysis endpoint. This gives us full control over
 * each candidate's email, name, and analysis data.
 */
const seedCandidate = async (
  database: Pool,
  opts: {
    user_id: number | null;
    name: string;
    email: string;
    skills?: string;
    summary?: string;
    score?: number;
    pdf_url?: string | null;
  },
): Promise<{ id: number; user_id: number | null; name: string }> => {
  const repo = createCandidateRepository(database);

  const candidate = await repo.findOrCreateCandidate({
    user_id: opts.user_id,
    name: opts.name,
    email: opts.email,
  });

  const resume = await repo.insertResume({
    candidate_id: candidate.id,
    pdf_url: opts.pdf_url ?? null,
  });

  if (resume !== undefined) {
    await repo.insertResumeAnalysis({
      resume_id: resume.id,
      skills: opts.skills ?? JSON.stringify(["TypeScript"]),
      experience: null,
      projects: null,
      summary: opts.summary ?? "Profile summary.",
      score: opts.score ?? 85,
    });
  }

  // If the user is a candidate and the candidate was unclaimed, claim it
  if (candidate.user_id === null && opts.user_id !== null) {
    await repo.updateCandidateUser(candidate.id, opts.user_id);
  }

  return { id: candidate.id, user_id: candidate.user_id, name: candidate.name };
};

const startServer = async (): Promise<TestContext> => {
  const database = await createTestDatabase();
  const uploadsDirectory = await mkdtemp(
    join(tmpdir(), "candidate-route-uploads-"),
  );

  const users = createUserRepository(database);
  const candidates = createCandidateRepository(database);
  const notifications = createNotificationRepository(database);
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
    "/api/candidates",
    createCandidatesRouter({
      jwtSecret,
      candidateRepository: candidates,
      userRepository: users,
      analyzeResumeService: async () => analysis,
      notificationRepository: notifications,
      uploadsDirectory,
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
        await closeTestDatabase(database);
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
  assert.equal(typeof body.accessToken, "string");
  assert.equal(typeof body.refreshToken, "string");
  assert.ok(isRecord(body.user));
  assert.equal(typeof body.user.id, "number");

  return {
    id: body.user.id,
    token: body.accessToken,
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

    // Seed candidates directly with unique emails
    await seedCandidate(database, {
      user_id: candidateUser.id,
      name: "Candidate One Profile",
      email: "one-profile@example.com",
      skills: JSON.stringify(["React"]),
      summary: "One summary.",
      score: 81,
    });
    await seedCandidate(database, {
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
      adminResult.candidates.map((c) => c.name).sort(),
      ["Candidate One Profile", "Candidate Two Profile"],
    );
    assert.equal(candidateResult.status, 200);
    assert.deepEqual(
      candidateResult.candidates.map((c) => c.name),
      ["Candidate One Profile"],
    );
  } finally {
    await server.close();
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

    // Seed candidates directly
    const ownedCandidate = await seedCandidate(database, {
      user_id: candidateUser.id,
      name: "Owned Profile",
      email: "owned-profile@example.com",
      skills: JSON.stringify(["React"]),
      summary: "Owned summary.",
      score: 83,
    });
    const otherCandidate = await seedCandidate(database, {
      user_id: otherCandidateUser.id,
      name: "Other Profile",
      email: "other-profile@example.com",
      skills: JSON.stringify(["SQL"]),
      summary: "Other summary.",
      score: 75,
    });

    const forbiddenOtherDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${otherCandidate.id}`,
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
    assert.notEqual(await candidates.getCandidateById(otherCandidate.id), undefined);

    const ownDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${ownedCandidate.id}`,
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
    assert.equal(await candidates.getCandidateById(ownedCandidate.id), undefined);

    const adminDeleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${otherCandidate.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${admin.token}`,
        },
      },
    );

    assert.equal(adminDeleteResponse.status, 200);
    assert.equal(await candidates.getCandidateById(otherCandidate.id), undefined);
  } finally {
    await server.close();
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

    // Upload PDF via the endpoint to create a proper candidate + resume
    const formData = new FormData();
    formData.append(
      "file",
      new File([createResumePdfBuffer()], pdfFileName, {
        type: "application/pdf",
      }),
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
    const uploadBody: unknown = await uploadResponse.json();
    assert.equal(uploadResponse.status, 201);
    assert.ok(isRecord(uploadBody));
    const candidateId = uploadBody.id as number;
    const pdfUrl = uploadBody.pdf_url as string;

    await database.query(
      "INSERT INTO messages (sender_id, receiver_id, candidate_id, content) VALUES ($1, $2, $3, $4)",
      [candidateUser.id, admin.id, candidateId, "Hello admin."],
    );
    await database.query(
      "INSERT INTO notifications (user_id, target_role, candidate_id, sender_id, type, title, content) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        null,
        "admin",
        candidateId,
        candidateUser.id,
        "candidate_application",
        "New candidate application",
        "Cleanup Profile submitted a resume.",
      ],
    );

    const deleteResponse = await fetch(
      `${server.baseUrl}/api/candidates/${candidateId}`,
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
    assert.equal(await candidates.getCandidateById(candidateId), undefined);
    assert.equal(
      Number(
        (
          await database.query<{ count: string }>(
            "SELECT COUNT(*)::int AS count FROM messages WHERE candidate_id = $1",
            [candidateId],
          )
        ).rows[0]?.count,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await database.query<{ count: string }>(
            "SELECT COUNT(*)::int AS count FROM notifications WHERE candidate_id = $1",
            [candidateId],
          )
        ).rows[0]?.count,
      ),
      0,
    );

    // Verify the PDF was deleted from disk. The uploaded file path may differ
    // from the pre-created one. Check the pdf_url from the response.
    if (pdfUrl) {
      const parsedUrl = new URL(pdfUrl);
      const uploadedFilePath = join(uploadsDirectory, parsedUrl.pathname.replace("/uploads/", ""));
      await assert.rejects(access(uploadedFilePath));
    }
  } finally {
    await server.close();
  }
});

test("candidate routes attach analyzed profiles to the candidate user and create new resume records", async () => {
  const { candidates, database, server } = await startServer();

  try {
    const candidateUser = await registerUser(server.baseUrl, {
      name: "Candidate Submitter",
      email: "candidate-submit@example.com",
      password: "secret",
      role: "candidate",
    });

    // First analysis creates the candidate
    const firstResponse = await postJson(
      `${server.baseUrl}/api/candidates/analyze`,
      { resumeText: "Original resume text" },
      candidateUser.token,
    );
    const firstBody: unknown = await firstResponse.json();

    assert.equal(firstResponse.status, 201);
    assert.ok(isRecord(firstBody));

    // Second analysis with same user finds the same candidate and creates new resume + analysis
    const response = await postJson(
      `${server.baseUrl}/api/candidates/analyze`,
      { resumeText: "Updated resume text" },
      candidateUser.token,
    );
    const body: unknown = await response.json();

    assert.equal(response.status, 201);
    assert.ok(isRecord(body));
    assert.equal(body.id, firstBody.id); // Same candidate
    assert.equal(body.user_id, candidateUser.id);

    // Should still be 1 candidate with 2 resumes
    assert.equal((await candidates.getCandidates()).length, 1);

    // Verify 2 resumes exist
    const resumeCount = await database.query<{ count: string }>(
      "SELECT COUNT(*)::int AS count FROM resumes WHERE candidate_id = $1",
      [body.id as number],
    );

    assert.equal(Number(resumeCount.rows[0]?.count), 2);
  } finally {
    await server.close();
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

    // Other user claims the email first via seed (uses analysis.email)
    await seedCandidate(database, {
      user_id: otherCandidateUser.id,
      name: "Existing Candidate",
      email: analysis.email,
      skills: JSON.stringify(["React"]),
      summary: "Existing owner summary.",
      score: 70,
    });

    // Candidate user tries to use the same email from fixture
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
  } finally {
    await server.close();
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
    assert.equal((await candidates.getCandidatesByUserId(candidateUser.id)).length, 1);
  } finally {
    await server.close();
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

    // Other user claims the analysis email first
    await seedCandidate(database, {
      user_id: otherCandidateUser.id,
      name: "Existing PDF Candidate",
      email: analysis.email,
      skills: JSON.stringify(["React"]),
      summary: "Existing PDF owner summary.",
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

    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      error: "Candidate profile already belongs to another account",
    });
  } finally {
    await server.close();
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

    // Create a legacy unclaimed candidate with the same email as the analysis fixture
    await seedCandidate(database, {
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

    // The candidate is found by email, claimed (user_id set), and new resume + analysis created
    // Note: the candidate's name stays as the original profile name (immutable basic info),
    // while the AI analysis skills/score come from the analysis fixture.
    assert.equal(body.user_id, candidateUser.id);
    assert.equal(body.name, "Legacy PDF Candidate"); // Profile name is immutable

    // 1 candidate total — the legacy one was found and reused
    assert.equal((await candidates.getCandidates()).length, 1);
  } finally {
    await server.close();
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
  }
});
