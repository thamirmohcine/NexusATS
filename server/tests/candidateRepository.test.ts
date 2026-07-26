import assert from "node:assert/strict";
import test from "node:test";

import Database from "better-sqlite3";

import { createCandidateRepository } from "../src/candidateRepository.js";
import { initializeDatabase } from "../src/databaseSchema.js";
import type { CreateCandidateInput } from "../src/db.js";

const createInput = (
  overrides: Partial<CreateCandidateInput> = {},
): CreateCandidateInput => ({
  name: "Maya Chen",
  email: "maya@example.com",
  phone: null,
  linkedin: null,
  github: null,
  skills: JSON.stringify(["React"]),
  experience: null,
  projects: null,
  summary: "Initial profile.",
  score: 72,
  ...overrides,
});

const countCandidates = (database: Database.Database): number => {
  const row = database.prepare<[], { count: number }>(
    "SELECT COUNT(*) AS count FROM candidates",
  ).get();

  return row?.count ?? 0;
};

test("upsertCandidate updates an existing candidate with the same email", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

  const originalCandidate = repository.upsertCandidate(createInput());
  const updatedCandidate = repository.upsertCandidate(
    createInput({
      name: "Maya C.",
      skills: JSON.stringify(["TypeScript", "Node.js"]),
      summary: "Updated profile.",
      score: 91,
    }),
  );

  assert.equal(updatedCandidate?.id, originalCandidate?.id);
  assert.equal(updatedCandidate?.name, "Maya C.");
  assert.equal(updatedCandidate?.skills, JSON.stringify(["TypeScript", "Node.js"]));
  assert.equal(updatedCandidate?.summary, "Updated profile.");
  assert.equal(updatedCandidate?.score, 91);
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate updates an existing candidate with the same name when email is missing", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

  const originalCandidate = repository.upsertCandidate(
    createInput({
      email: null,
      skills: JSON.stringify(["Express"]),
      summary: "Initial no-email profile.",
      score: 68,
    }),
  );
  const updatedCandidate = repository.upsertCandidate(
    createInput({
      email: null,
      skills: JSON.stringify(["SQLite", "TypeScript"]),
      summary: "Updated no-email profile.",
      score: 84,
    }),
  );

  assert.equal(updatedCandidate?.id, originalCandidate?.id);
  assert.equal(updatedCandidate?.skills, JSON.stringify(["SQLite", "TypeScript"]));
  assert.equal(updatedCandidate?.summary, "Updated no-email profile.");
  assert.equal(updatedCandidate?.score, 84);
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate keeps an existing email when updating by name without a new email", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

  const originalCandidate = repository.upsertCandidate(createInput());
  const updatedCandidate = repository.upsertCandidate(
    createInput({
      email: null,
      skills: JSON.stringify(["TypeScript"]),
      summary: "Analyzed profile.",
      score: 88,
    }),
  );

  assert.equal(updatedCandidate?.id, originalCandidate?.id);
  assert.equal(updatedCandidate?.email, "maya@example.com");
  assert.equal(updatedCandidate?.summary, "Analyzed profile.");
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate links an existing same-email profile to a candidate user", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);
  const userResult = database
    .prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    )
    .run("Maya User", "maya-user@example.com", "hashed-password", "candidate");
  const userId = Number(userResult.lastInsertRowid);

  const originalCandidate = repository.upsertCandidate(createInput());
  const updatedCandidate = repository.upsertCandidate(
    createInput({
      user_id: userId,
      name: "Maya Chen Updated",
      skills: JSON.stringify(["TypeScript", "Node.js"]),
      summary: "Candidate-owned profile.",
      score: 93,
    }),
  );

  assert.equal(updatedCandidate?.id, originalCandidate?.id);
  assert.equal(updatedCandidate?.user_id, userId);
  assert.equal(updatedCandidate?.name, "Maya Chen Updated");
  assert.equal(updatedCandidate?.summary, "Candidate-owned profile.");
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("upsertCandidate stores rich resume fields", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

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

  const candidate = repository.upsertCandidate(
    createInput({
      phone: "+1 555 0100",
      linkedin: "https://linkedin.com/in/mayachen",
      github: "https://github.com/mayachen",
      experience,
      projects,
    }),
  );

  assert.equal(candidate?.phone, "+1 555 0100");
  assert.equal(candidate?.linkedin, "https://linkedin.com/in/mayachen");
  assert.equal(candidate?.github, "https://github.com/mayachen");
  assert.equal(candidate?.pdf_url, null);
  assert.equal(candidate?.experience, experience);
  assert.equal(candidate?.projects, projects);

  database.close();
});

test("upsertCandidate stores an uploaded PDF URL", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

  const candidate = repository.upsertCandidate(
    createInput({
      pdf_url: "http://localhost:5000/uploads/123-resume.pdf",
    }),
  );

  assert.equal(
    candidate?.pdf_url,
    "http://localhost:5000/uploads/123-resume.pdf",
  );

  database.close();
});

test("deleteCandidate removes an existing candidate and reports missing candidates", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createCandidateRepository(database);

  const candidate = repository.upsertCandidate(createInput());

  assert.equal(countCandidates(database), 1);
  assert.equal(repository.deleteCandidate(candidate?.id ?? 0), true);
  assert.equal(countCandidates(database), 0);
  assert.equal(repository.deleteCandidate(candidate?.id ?? 0), false);

  database.close();
});

test("initializeDatabase consolidates legacy duplicate candidate rows before adding unique indexes", () => {
  const database = new Database(":memory:");

  database.exec(`
    CREATE TABLE candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      skills TEXT,
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

  assert.equal(countCandidates(database), 1);

  const repository = createCandidateRepository(database);
  const updatedCandidate = repository.upsertCandidate(
    createInput({
      skills: JSON.stringify(["SQLite"]),
      summary: "Post-migration profile.",
      score: 95,
    }),
  );

  assert.equal(updatedCandidate?.summary, "Post-migration profile.");
  assert.equal(countCandidates(database), 1);

  database.close();
});

test("initializeDatabase adds rich resume columns to legacy candidate tables", () => {
  const database = new Database(":memory:");

  database.exec(`
    CREATE TABLE candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      skills TEXT,
      summary TEXT,
      score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  initializeDatabase(database);

  const columns = database
    .prepare<[], { name: string }>("PRAGMA table_info(candidates)")
    .all()
    .map((column) => column.name);

  assert.ok(columns.includes("phone"));
  assert.ok(columns.includes("linkedin"));
  assert.ok(columns.includes("github"));
  assert.ok(columns.includes("experience"));
  assert.ok(columns.includes("projects"));
  assert.ok(columns.includes("pdf_url"));

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
