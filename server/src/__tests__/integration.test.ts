/// <reference types="jest" />

import Database from "better-sqlite3";
import express, { type Express } from "express";
import { access, mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";

import { createCandidateRepository } from "../candidateRepository.js";
import { initializeDatabase } from "../databaseSchema.js";
import { createNotificationRepository } from "../notificationRepository.js";
import { createAuthRouter } from "../routes/auth.js";
import { createCandidatesRouter } from "../routes/candidates.js";
import { createChatRouter } from "../routes/chat.js";
import { createNotificationsRouter } from "../routes/notifications.js";
import type { ResumeAnalysis } from "../services/ai.js";
import { createUserRepository } from "../userRepository.js";

interface AuthResponseBody {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: "candidate" | "admin";
  };
}

interface CandidateResponseBody {
  id: number;
  user_id: number | null;
  name: string;
  pdf_url: string | null;
}

interface CountRow {
  count: number;
}

interface TestApplication {
  app: Express;
  database: Database.Database;
  uploadsDirectory: string;
}

const jwtSecret = "jest-test-secret";

const analysis: ResumeAnalysis = {
  candidateName: "Jest Candidate",
  email: "jest-candidate@example.com",
  phone: null,
  linkedin: null,
  github: null,
  skills: ["TypeScript", "Express"],
  experience: [],
  projects: [],
  summary: {
    en: "Jest integration candidate.",
    fr: "Candidat integration Jest.",
    ar: "مرشح اختبار تكامل Jest.",
  },
  score: 89,
};

let cleanupTasks: Array<() => Promise<void>> = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAuthResponseBody = (value: unknown): value is AuthResponseBody =>
  isRecord(value) &&
  typeof value.token === "string" &&
  isRecord(value.user) &&
  typeof value.user.id === "number" &&
  typeof value.user.name === "string" &&
  typeof value.user.email === "string" &&
  (value.user.role === "candidate" || value.user.role === "admin");

const isCandidateResponseBody = (
  value: unknown,
): value is CandidateResponseBody =>
  isRecord(value) &&
  typeof value.id === "number" &&
  (typeof value.user_id === "number" || value.user_id === null) &&
  typeof value.name === "string" &&
  (typeof value.pdf_url === "string" || value.pdf_url === null);

const createTestApplication = async (): Promise<TestApplication> => {
  const database = new Database(":memory:");
  const uploadsDirectory = await mkdtemp(join(tmpdir(), "jest-uploads-"));

  initializeDatabase(database);

  const userRepository = createUserRepository(database);
  const candidateRepository = createCandidateRepository(database);
  const notificationRepository = createNotificationRepository(database);
  const app = express();

  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      jwtSecret,
      userRepository,
    }),
  );
  app.use(
    "/api/candidates",
    createCandidatesRouter({
      jwtSecret,
      candidateRepository,
      userRepository,
      analyzeResumeService: async () => analysis,
      extractPdfTextService: async () => "Resume text from mocked PDF",
      notificationRepository,
      uploadsDirectory,
    }),
  );
  app.use(
    "/api/chat",
    createChatRouter({
      jwtSecret,
      database,
      userRepository,
      candidateRepository,
      notificationRepository,
    }),
  );
  app.use(
    "/api/notifications",
    createNotificationsRouter({
      jwtSecret,
      userRepository,
      notificationRepository,
    }),
  );

  cleanupTasks.push(async () => {
    database.close();
    await rm(uploadsDirectory, { force: true, recursive: true });
  });

  return {
    app,
    database,
    uploadsDirectory,
  };
};

const registerUser = async (
  app: Express,
  input: {
    name: string;
    email: string;
    password: string;
    role: "candidate" | "admin";
  },
): Promise<AuthResponseBody> => {
  const response = await request(app).post("/api/auth/register").send(input);
  const body: unknown = response.body;

  expect(response.status).toBe(201);
  expect(isAuthResponseBody(body)).toBe(true);

  if (!isAuthResponseBody(body)) {
    throw new Error("Unexpected auth response body");
  }

  return body;
};

const getCandidateScopedCount = (
  database: Database.Database,
  tableName: "messages" | "notifications",
  candidateId: number,
): number => {
  const row = database
    .prepare<[number], CountRow>(
      `SELECT COUNT(*) AS count FROM ${tableName} WHERE candidate_id = ?`,
    )
    .get(candidateId);

  return row?.count ?? 0;
};

afterEach(async () => {
  const tasks = cleanupTasks;
  cleanupTasks = [];
  await Promise.all(tasks.map((cleanupTask) => cleanupTask()));
});

describe("auth integration", () => {
  test("registers and logs in a user", async () => {
    const { app } = await createTestApplication();
    const registeredUser = await registerUser(app, {
      name: "Ada Admin",
      email: "ada@example.com",
      password: "secret",
      role: "admin",
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "ada@example.com",
      password: "secret",
    });
    const loginBody: unknown = loginResponse.body;

    expect(loginResponse.status).toBe(200);
    expect(isAuthResponseBody(loginBody)).toBe(true);

    if (!isAuthResponseBody(loginBody)) {
      throw new Error("Unexpected login response body");
    }

    expect(loginBody.user.id).toBe(registeredUser.user.id);
    expect(loginBody.user.role).toBe("admin");
  });
});

describe("candidate integration", () => {
  test("fetches uploaded candidates and lets admins delete candidates with related records and files", async () => {
    const { app, database, uploadsDirectory } = await createTestApplication();
    const admin = await registerUser(app, {
      name: "Admin User",
      email: "admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidate = await registerUser(app, {
      name: "Candidate User",
      email: "candidate@example.com",
      password: "secret",
      role: "candidate",
    });

    const uploadResponse = await request(app)
      .post("/api/candidates/upload-pdf")
      .set("Authorization", `Bearer ${candidate.token}`)
      .attach("file", Buffer.from("%PDF-1.4 test resume"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });
    const uploadedCandidateBody: unknown = uploadResponse.body;

    expect(uploadResponse.status).toBe(201);
    expect(isCandidateResponseBody(uploadedCandidateBody)).toBe(true);

    if (!isCandidateResponseBody(uploadedCandidateBody)) {
      throw new Error("Unexpected candidate response body");
    }

    const candidateId = uploadedCandidateBody.id;
    const pdfUrl = uploadedCandidateBody.pdf_url;

    expect(pdfUrl).not.toBeNull();

    const otherCandidate = await registerUser(app, {
      name: "Other Candidate",
      email: "other-candidate@example.com",
      password: "secret",
      role: "candidate",
    });
    const forbiddenCandidateDeleteResponse = await request(app)
      .delete(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${otherCandidate.token}`);

    expect(forbiddenCandidateDeleteResponse.status).toBe(404);
    expect(forbiddenCandidateDeleteResponse.body).toEqual({
      error: "Candidate not found",
    });

    await request(app)
      .post("/api/chat/send")
      .set("Authorization", `Bearer ${candidate.token}`)
      .send({
        receiver_id: admin.user.id,
        candidate_id: candidateId,
        content: "Please review my resume.",
      })
      .expect(201);

    expect(getCandidateScopedCount(database, "messages", candidateId)).toBe(1);
    expect(getCandidateScopedCount(database, "notifications", candidateId)).toBe(
      2,
    );

    const adminFetchResponse = await request(app)
      .get("/api/candidates")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(adminFetchResponse.status).toBe(200);
    expect(Array.isArray(adminFetchResponse.body)).toBe(true);
    expect(adminFetchResponse.body).toHaveLength(1);

    const deleteResponse = await request(app)
      .delete(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      message: "Candidate deleted successfully",
    });
    expect(getCandidateScopedCount(database, "messages", candidateId)).toBe(0);
    expect(getCandidateScopedCount(database, "notifications", candidateId)).toBe(
      0,
    );

    if (pdfUrl === null) {
      throw new Error("Expected uploaded candidate to include a PDF URL");
    }

    await expect(
      access(join(uploadsDirectory, basename(new URL(pdfUrl).pathname))),
    ).rejects.toThrow();
  });
});

describe("chat and notifications integration", () => {
  test("creates admin notifications when candidates apply and send messages", async () => {
    const { app } = await createTestApplication();
    const admin = await registerUser(app, {
      name: "Notify Admin",
      email: "notify-admin@example.com",
      password: "secret",
      role: "admin",
    });
    const candidate = await registerUser(app, {
      name: "Notify Candidate",
      email: "notify-candidate@example.com",
      password: "secret",
      role: "candidate",
    });

    const analyzeResponse = await request(app)
      .post("/api/candidates/analyze")
      .set("Authorization", `Bearer ${candidate.token}`)
      .send({ resumeText: "Candidate resume text" });
    const analyzedCandidateBody: unknown = analyzeResponse.body;

    expect(analyzeResponse.status).toBe(201);
    expect(isCandidateResponseBody(analyzedCandidateBody)).toBe(true);

    if (!isCandidateResponseBody(analyzedCandidateBody)) {
      throw new Error("Unexpected analyzed candidate body");
    }

    await request(app)
      .post("/api/chat/send")
      .set("Authorization", `Bearer ${candidate.token}`)
      .send({
        receiver_id: admin.user.id,
        candidate_id: analyzedCandidateBody.id,
        content: "Hello admin.",
      })
      .expect(201);

    const notificationsResponse = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${admin.token}`);
    const notificationsBody: unknown = notificationsResponse.body;

    expect(notificationsResponse.status).toBe(200);
    expect(Array.isArray(notificationsBody)).toBe(true);

    if (!Array.isArray(notificationsBody)) {
      throw new Error("Unexpected notifications response body");
    }

    expect(
      notificationsBody.map((notification: unknown) =>
        isRecord(notification) ? notification.type : null,
      ),
    ).toEqual(["message", "candidate_application"]);
  });
});
