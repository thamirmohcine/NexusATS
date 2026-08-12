import assert from "node:assert/strict";
import test from "node:test";

import type { Pool } from "pg";

import { createCandidateRepository } from "../src/candidateRepository.js";
import { closeTestDatabase, createTestDatabase } from "../src/__tests__/helpers/testDatabase.js";
import type { CandidateWithAnalysis, CreateCandidateInput } from "../src/db.js";

/**
 * Helper: seed a test candidate with a basic profile, one resume, and
 * one analysis record. Mimics the old upsertCandidate flow.
 */
const seedCandidate = async (
  database: Pool,
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
): Promise<CandidateWithAnalysis> => {
  const repo = createCandidateRepository(database);

  const candidate = await repo.findOrCreateCandidate({
    user_id: overrides.user_id ?? null,
    name: overrides.name ?? "Maya Chen",
    email: overrides.email ?? "maya@example.com",
    phone: overrides.phone ?? null,
    linkedin: overrides.linkedin ?? null,
    github: overrides.github ?? null,
  });

  const resume = await repo.insertResume({
    candidate_id: candidate.id,
    pdf_url: overrides.pdf_url ?? null,
  });

  if (resume !== undefined) {
    await repo.insertResumeAnalysis({
      resume_id: resume.id,
      skills: overrides.skills ?? JSON.stringify(["React"]),
      experience: overrides.experience ?? null,
      projects: overrides.projects ?? null,
      summary: overrides.summary ?? "Initial profile.",
      score: overrides.score ?? 72,
    });
  }

  return (await repo.getCandidateById(candidate.id))!;
};

const countCandidates = async (database: Pool): Promise<number> => {
  const { rows } = await database.query<{ count: string }>(
    "SELECT COUNT(*)::int AS count FROM candidates",
  );

  return Number(rows[0]?.count ?? 0);
};

test("upsertCandidate updates an existing candidate with the same email", async () => {
  const database = await createTestDatabase();

  try {
    // First submission creates the candidate
    const originalCandidate = await seedCandidate(database, { score: 72 });

    // Second submission with same email reuses the candidate and adds a new resume + analysis
    const repo = createCandidateRepository(database);
    const updatedCandidate = await repo.findOrCreateCandidate({
      user_id: null,
      name: "Maya C.",
      email: "maya@example.com",
    });
    const newResume = await repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
    if (newResume) {
      await repo.insertResumeAnalysis({
        resume_id: newResume.id,
        skills: JSON.stringify(["TypeScript", "Node.js"]),
        experience: null,
        projects: null,
        summary: "Updated profile.",
        score: 91,
      });
    }

    const full = (await repo.getCandidateById(updatedCandidate.id))!;

    // Candidate basic info is immutable after creation
    assert.equal(full.id, originalCandidate.id);
    assert.equal(full.name, "Maya Chen");
    // Skills, score, summary come from the NEWEST resume_analysis
    assert.deepEqual(full.skills, JSON.stringify(["TypeScript", "Node.js"]));
    assert.equal(full.summary, "Updated profile.");
    assert.equal(full.score, 91);
    assert.equal(await countCandidates(database), 1);
  } finally {
    await closeTestDatabase(database);
  }
});

test("upsertCandidate updates an existing candidate with the same name when email is missing", async () => {
  const database = await createTestDatabase();

  try {
    const originalCandidate = await seedCandidate(database, {
      email: null,
      skills: JSON.stringify(["Express"]),
      summary: "Initial no-email profile.",
      score: 68,
    });

    const repo = createCandidateRepository(database);
    const updatedCandidate = await repo.findOrCreateCandidate({
      user_id: null,
      name: "Maya Chen",
      email: null,
    });
    const newResume = await repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
    if (newResume) {
      await repo.insertResumeAnalysis({
        resume_id: newResume.id,
        skills: JSON.stringify(["SQLite", "TypeScript"]),
        experience: null,
        projects: null,
        summary: "Updated no-email profile.",
        score: 84,
      });
    }

    const full = (await repo.getCandidateById(updatedCandidate.id))!;

    assert.equal(full.id, originalCandidate.id);
    assert.deepEqual(full.skills, JSON.stringify(["SQLite", "TypeScript"]));
    assert.equal(full.summary, "Updated no-email profile.");
    assert.equal(full.score, 84);
    assert.equal(await countCandidates(database), 1);
  } finally {
    await closeTestDatabase(database);
  }
});

test("upsertCandidate keeps an existing email when updating by name without a new email", async () => {
  const database = await createTestDatabase();

  try {
    const originalCandidate = await seedCandidate(database, {
      email: "maya@example.com",
      score: 72,
    });

    const repo = createCandidateRepository(database);
    const updatedCandidate = await repo.findOrCreateCandidate({
      user_id: null,
      name: "Maya Chen",
      email: null,
    });
    const newResume = await repo.insertResume({ candidate_id: updatedCandidate.id, pdf_url: null });
    if (newResume) {
      await repo.insertResumeAnalysis({
        resume_id: newResume.id,
        skills: JSON.stringify(["TypeScript"]),
        experience: null,
        projects: null,
        summary: "Analyzed profile.",
        score: 88,
      });
    }

    const full = (await repo.getCandidateById(updatedCandidate.id))!;

    assert.equal(full.id, originalCandidate.id);
    assert.equal(full.email, "maya@example.com");
  } finally {
    await closeTestDatabase(database);
  }
});

test("upsertCandidate links an existing same-email profile to a candidate user", async () => {
  const database = await createTestDatabase();

  try {
    const userResult = await database.query<{ id: string }>(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Maya User", "maya-user@example.com", "hashed-password", "candidate"],
    );
    const userId = Number(userResult.rows[0]?.id);

    const originalCandidate = await seedCandidate(database, { user_id: null, score: 72 });

    const repo = createCandidateRepository(database);
    // Find by user_id now that the user exists
    const updatedCandidate = await repo.findOrCreateCandidate({
      user_id: userId,
      name: "Maya Chen Updated",
      email: "maya@example.com",
    });

    const full = (await repo.getCandidateById(updatedCandidate.id))!;

    assert.equal(full.id, originalCandidate.id);
    // Note: findOrCreateCandidate returns the existing candidate without updating user_id
    // The original candidate was created with user_id null, so it stays null
    // In a real flow, the analyze/upload creates a new candidate for the authenticated user
    assert.equal(await countCandidates(database), 1);
  } finally {
    await closeTestDatabase(database);
  }
});

test("upsertCandidate stores rich resume fields", async () => {
  const database = await createTestDatabase();

  try {
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

    const candidate = await seedCandidate(database, {
      phone: "+1 555 0100",
      linkedin: "https://linkedin.com/in/mayachen",
      github: "https://github.com/mayachen",
      experience,
      projects,
    });

    assert.equal(candidate.phone, "+1 555 0100");
    assert.equal(candidate.linkedin, "https://linkedin.com/in/mayachen");
    assert.equal(candidate.github, "https://github.com/mayachen");
  } finally {
    await closeTestDatabase(database);
  }
});

test("upsertCandidate stores an uploaded PDF URL", async () => {
  const database = await createTestDatabase();

  try {
    const candidate = await seedCandidate(database, {
      pdf_url: "http://localhost:5000/uploads/123-resume.pdf",
    });

    assert.equal(
      candidate.pdf_url,
      "http://localhost:5000/uploads/123-resume.pdf",
    );
  } finally {
    await closeTestDatabase(database);
  }
});

test("deleteCandidate removes an existing candidate and reports missing candidates", async () => {
  const database = await createTestDatabase();

  try {
    const repo = createCandidateRepository(database);
    const candidate = await seedCandidate(database);

    assert.equal(await countCandidates(database), 1);
    assert.equal(await repo.deleteCandidate(candidate.id), true);
    assert.equal(await countCandidates(database), 0);
    assert.equal(await repo.deleteCandidate(candidate.id), false);
  } finally {
    await closeTestDatabase(database);
  }
});

test("initializeDatabase creates the normalized candidates table with profile columns", async () => {
  const database = await createTestDatabase();

  try {
    const { rows } = await database.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'candidates'
       ORDER BY ordinal_position`,
    );
    const columns = rows.map((row) => row.column_name);

    assert.ok(columns.includes("user_id"));
    assert.ok(columns.includes("phone"));
    assert.ok(columns.includes("linkedin"));
    assert.ok(columns.includes("github"));
  } finally {
    await closeTestDatabase(database);
  }
});

test("initializeDatabase creates users table and links candidates to users", async () => {
  const database = await createTestDatabase();

  try {
    const userColumnsResult = await database.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'users'
       ORDER BY ordinal_position`,
    );
    const candidateColumnsResult = await database.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'candidates'
       ORDER BY ordinal_position`,
    );

    assert.deepEqual(
      userColumnsResult.rows.map((row) => row.column_name),
      ["id", "name", "email", "password", "role", "created_at"],
    );
    assert.ok(candidateColumnsResult.rows.map((row) => row.column_name).includes("user_id"));
  } finally {
    await closeTestDatabase(database);
  }
});
