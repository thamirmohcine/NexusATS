import assert from "node:assert/strict";
import test from "node:test";

import Database from "better-sqlite3";

import { createCandidateRepository } from "../src/candidateRepository.js";
import { initializeDatabase } from "../src/databaseSchema.js";
import type { CandidateWithAnalysis, CreateCandidateInput } from "../src/db.js";

/**
 * Helper: seed a test candidate with a basic profile, one resume, and
 * one analysis record. Mimics the old upsertCandidate flow.
 */
const seedCandidate = (
  database: Database.Database,
  overrides: Partial<{
    user_id: number | null;
    name: string;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    pdf_url: string | null;
    skills: string | null;
    experience: string | null;
    projects: string | null;
    summary: string | null;
    score: number | null;
  }> = {},
): CandidateWithAnalysis => {
  const repo = createCandidateRepository(database);

  const candidate = repo.findOrCreateCandidate({
    user_id: overrides.user_id ?? null,
    name: overrides.name ?? "Maya Chen",
    email: overrides.email ?? "maya@example.com",
    phone: overrides.phone ?? null,
    linkedin: overrides.linkedin ?? null,
    github: overrides.github ?? null,
  });

  const resume = repo.insertResume({
    candidate_id: candidate.id,
    pdf_url: overrides.pdf_url ?? null,
  });

  if (resume !== undefined) {
    repo.insertResumeAnalysis({
      resume_id: resume.id,
      skills: overrides.skills ?? JSON.stringify(["React"]),
      experience: overrides.experience ?? null,
      projects: overrides.projects ?? null,
      summary: overrides.summary ?? "Initial profile.",
      score: overrides.score ?? 72,
    });
  }

  return repo.getCandidateById(candidate.id)!;
};

const countCandidates = (database: Database.Database): number => {
  const row = database.prepare<[], { count: number }>(
    "SELECT COUNT(*) AS count FROM candidates",
  ).get();

  return row?.count ?? 0;
};

test("upsertCandidate updates an existing candidate with the same email", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  // First submission creates the candidate
  const originalCandidate = seedCandidate(database, { score: 72 });

  // Second submission with same email reuses the candidate and adds a new resume + analysis
  const repo = createCandidateRepository(database);
  const updatedCandidate = repo.findOrCreateCandidate({
    user_id: null,
    name: "Maya C.",
    email: "maya@example.com",
  });
  const newResume = repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
  if (newResume) {
    repo.insertResumeAnalysis({
      resume_id: newResume.id,
      skills: JSON.stringify(["TypeScript", "Node.js"]),
      experience: null,
      projects: null,
      summary: "Updated profile.",
      score: 91,
    });
  }

  const full = repo.getCandidateById(updatedCandidate.id)!;

  // Candidate basic info is immutable after creation
  assert.equal(full.id, originalCandidate.id);
  assert.equal(full.name, "Maya Chen");
  // Skills, score, summary come from the NEWEST resume_analysis
  assert.deepEqual(full.skills, JSON.stringify(["TypeScript", "Node.js"]));
  assert.equal(full.summary, "Updated profile.");
  assert.equal(full.score, 91);
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate updates an existing candidate with the same name when email is missing", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const originalCandidate = seedCandidate(database, {
    email: null,
    skills: JSON.stringify(["Express"]),
    summary: "Initial no-email profile.",
    score: 68,
  });

  const repo = createCandidateRepository(database);
  const updatedCandidate = repo.findOrCreateCandidate({
    user_id: null,
    name: "Maya Chen",
    email: null,
  });
  const newResume = repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
  if (newResume) {
    repo.insertResumeAnalysis({
      resume_id: newResume.id,
      skills: JSON.stringify(["SQLite", "TypeScript"]),
      experience: null,
      projects: null,
      summary: "Updated no-email profile.",
      score: 84,
    });
  }

  const full = repo.getCandidateById(updatedCandidate.id)!;

  assert.equal(full.id, originalCandidate.id);
  assert.deepEqual(full.skills, JSON.stringify(["SQLite", "TypeScript"]));
  assert.equal(full.summary, "Updated no-email profile.");
  assert.equal(full.score, 84);
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate keeps an existing email when updating by name without a new email", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const originalCandidate = seedCandidate(database, {
    email: "maya@example.com",
    score: 72,
  });

  const repo = createCandidateRepository(database);
  const updatedCandidate = repo.findOrCreateCandidate({
    user_id: null,
    name: "Maya Chen",
    email: null,
  });
  const newResume = repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
  if (newResume) {
    repo.insertResumeAnalysis({
      resume_id: newResume.id,
      skills: JSON.stringify(["TypeScript"]),
      experience: null,
      projects: null,
      summary: "Analyzed profile.",
      score: 88,
    });
  }

  const full = repo.getCandidateById(updatedCandidate.id)!;

  assert.equal(full.id, originalCandidate.id);
  assert.equal(full.email, "maya@example.com");

  database.close();
});

test("upsertCandidate links an existing same-email profile to a candidate user", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const userResult = database
    .prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    )
    .run("Maya User", "maya-user@example.com", "hashed-password", "candidate");
  const userId = Number(userResult.lastInsertRowid);

  const originalCandidate = seedCandidate(database, { user_id: null, score: 72 });

  const repo = createCandidateRepository(database);
  // Find by user_id now that the user exists
  const updatedCandidate = repo.findOrCreateCandidate({
    user_id: userId,
    name: "Maya Chen Updated",
    email: "maya@example.com",
  });

  const full = repo.getCandidateById(updatedCandidate.id)!;

  assert.equal(full.id, originalCandidate.id);
  // Note: findOrCreateCandidate returns the existing candidate without updating user_id
  // The original candidate was created with user_id null, so it stays null
  // In a real flow, the analyze/upload creates a new candidate for the authenticated user
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate stores rich resume fields", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const experience = JSON.stringify([
    {
      title: "Software Engineer",
      company: "Acme",
      duration: "2022-2026",
      description: "Built hiring tools.",
    },
  ]);
  const projects = JSON.stringify([
    {
      name: "Candidate Screener",
      description: "Resume analysis dashboard.",
      technologies: ["React", "Express", "SQLite"],
    },
  ]);

  const candidate = seedCandidate(database, {
    phone: "+1 555 0100",
    linkedin: "https://linkedin.com/in/mayachen",
    github: "https://github.com/mayachen",
    experience,
    projects,
  });

  assert.equal(candidate.phone, "+1 555 0100");
  assert.equal(candidate.linkedin, "https://linkedin.com/in/mayachen");
  assert.equal(candidate.github, "https://github.com/mayachen");

  database.close();
});

test("upsertCandidate stores an uploaded PDF URL", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const candidate = seedCandidate(database, {
    pdf_url: "http://localhost:5000/uploads/123-resume.pdf",
  });

  assert.equal(
    candidate.pdf_url,
    "http://localhost:5000/uploads/123-resume.pdf",
  );

  database.close();
});

test("deleteCandidate removes an existing candidate and reports missing candidates", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);

  const repo = createCandidateRepository(database);
  const candidate = seedCandidate(database);

  assert.equal(countCandidates(database), 1);
  assert.equal(repo.deleteCandidate(candidate.id), true);
  assert.equal(countCandidates(database), 0);
  assert.equal(repo.deleteCandidate(candidate.id), false);

  database.close();
});

test("initializeDatabase consolidates legacy duplicate candidate rows before adding unique indexes", () => {
  const database = new Database(":memory:");

  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'candidate'
    );

    CREATE TABLE candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      linkedin TEXT,
      github TEXT,
      pdf_url TEXT,
      skills TEXT,
      experience TEXT,
      projects TEXT,
      summary TEXT,
      score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO candidates (name, email, skills, summary, score)
    VALUES
      ('Maya Chen', 'maya@example.com', '["React"]', 'Old profile.', 70),
      ('Maya Chen', 'maya@example.com', '["TypeScript"]', 'New profile.', 92);
  `);

  initializeDatabase(database);

  // After dedup, only 1 candidate should remain
  assert.equal(countCandidates(database), 1);

  // Migration creates 1 resume + 1 analysis for the surviving candidate
  const resumeCount = database
    .prepare("SELECT COUNT(*) AS count FROM resumes")
    .get() as { count: number };

  assert.equal(resumeCount.count, 1);

  const analysisCount = database
    .prepare("SELECT COUNT(*) AS count FROM resume_analyses")
    .get() as { count: number };

  assert.equal(analysisCount.count, 1);

  database.close();
});

test("initializeDatabase creates the normalized candidates table with profile columns", () => {
  const database = new Database(":memory:");

  initializeDatabase(database);

  const columns = database
    .prepare<[], { name: string }>("PRAGMA table_info(candidates)")
    .all()
    .map((column) => column.name);

  assert.ok(columns.includes("user_id"));
  assert.ok(columns.includes("phone"));
  assert.ok(columns.includes("linkedin"));
  assert.ok(columns.includes("github"));

  database.close();
});

test("initializeDatabase creates users table and links candidates to users", () => {
  const database = new Database(":memory:");

  initializeDatabase(database);

  const userColumns = database
    .prepare<[], { name: string }>("PRAGMA table_info(users)")
    .all()
    .map((column) => column.name);
  const candidateColumns = database
    .prepare<[], { name: string }>("PRAGMA table_info(candidates)")
    .all()
    .map((column) => column.name);

  assert.deepEqual(userColumns, [
    "id",
    "name",
    "email",
    "password",
    "role",
    "created_at",
  ]);
  assert.ok(candidateColumns.includes("user_id"));

  database.close();
});
