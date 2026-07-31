import type Database from "better-sqlite3";

import type {
  Candidate,
  CandidateWithAnalysis,
  CreateCandidateInput,
  CreateResumeInput,
  CreateResumeAnalysisInput,
  Resume,
  ResumeAnalysis,
} from "./db.js";
import { createLogger, type Logger } from "./services/logger.js";

interface CandidateLookupInput {
  user_id: number | null;
  name: string;
  email: string | null;
}

export interface CandidateRepository {
  getCandidates: () => CandidateWithAnalysis[];
  getCandidatesByUserId: (userId: number) => CandidateWithAnalysis[];
  getCandidateById: (id: number) => CandidateWithAnalysis | undefined;
  findOrCreateCandidate: (input: CreateCandidateInput) => Candidate;
  insertResume: (input: CreateResumeInput) => Resume | undefined;
  insertResumeAnalysis: (
    input: CreateResumeAnalysisInput,
  ) => ResumeAnalysis | undefined;
  deleteCandidate: (id: number) => boolean;
  deleteCandidateWithRelatedRecords: (
    id: number,
  ) => CandidateWithAnalysis | undefined;
  deleteCandidateForUser: (id: number, userId: number) => boolean;
  updateCandidateUser: (candidateId: number, userId: number) => void;
}

/**
 * Map a raw JOIN row to the flat CandidateWithAnalysis shape.
 * All nullable analysis fields default to null when there's no associated
 * resume or analysis row.
 */
const mapToCandidateWithAnalysis = (
  row: Record<string, unknown>,
): CandidateWithAnalysis => ({
  id: row.id as number,
  user_id: (row.user_id as number | null) ?? null,
  name: row.name as string,
  email: (row.email as string | null) ?? null,
  phone: (row.phone as string | null) ?? null,
  linkedin: (row.linkedin as string | null) ?? null,
  github: (row.github as string | null) ?? null,
  created_at: row.created_at as string,
  pdf_url: (row.pdf_url as string | null) ?? null,
  skills: (row.skills as string | null) ?? null,
  experience: (row.experience as string | null) ?? null,
  projects: (row.projects as string | null) ?? null,
  summary: (row.summary as string | null) ?? null,
  score: (row.score as number | null) ?? null,
});

export const createCandidateRepository = (
  database: Database.Database,
  logger?: Logger,
): CandidateRepository => {
  const repoLogger = (logger ?? createLogger()).child({ module: "CandidateRepository" });

  // ── SELECT: candidates LEFT JOIN latest resume LEFT JOIN latest analysis ─

  const candidatesWithAnalysisQuery = `
    SELECT
      c.id,
      c.user_id,
      c.name,
      c.email,
      c.phone,
      c.linkedin,
      c.github,
      c.created_at,
      r.pdf_url,
      ra.skills,
      ra.experience,
      ra.projects,
      ra.summary,
      ra.score
    FROM candidates c
    LEFT JOIN (
      SELECT id, candidate_id, pdf_url
      FROM resumes
      WHERE id IN (SELECT MAX(id) FROM resumes GROUP BY candidate_id)
    ) r ON r.candidate_id = c.id
    LEFT JOIN (
      SELECT resume_id, skills, experience, projects, summary, score
      FROM resume_analyses
      WHERE id IN (SELECT MAX(id) FROM resume_analyses GROUP BY resume_id)
    ) ra ON ra.resume_id = r.id
  `;

  const selectCandidatesStatement = database.prepare<[], Record<string, unknown>>(
    `${candidatesWithAnalysisQuery}
     ORDER BY c.created_at DESC, c.id DESC`,
  );

  const selectCandidatesByUserIdStatement = database.prepare<
    [number],
    Record<string, unknown>
  >(
    `${candidatesWithAnalysisQuery}
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC, c.id DESC`,
  );

  const selectCandidateByIdStatement = database.prepare<
    [number],
    Record<string, unknown> | undefined
  >(
    `${candidatesWithAnalysisQuery}
     WHERE c.id = ?`,
  );

  // ── Find existing candidate by user_id / email / name match ──────────

  const selectExistingCandidateStatement = database.prepare<
    CandidateLookupInput,
    Candidate
  >(`
    SELECT id, user_id, name, email, phone, linkedin, github, created_at
    FROM candidates
    WHERE (
        @user_id IS NOT NULL
        AND user_id = @user_id
      )
      OR (
        @email IS NOT NULL
        AND email IS NOT NULL
        AND lower(email) = lower(@email)
      )
      OR (
        @email IS NULL
        AND lower(name) = lower(@name)
      )
    ORDER BY
      CASE
        WHEN @user_id IS NOT NULL
          AND user_id = @user_id
        THEN 0
        WHEN @email IS NOT NULL
          AND email IS NOT NULL
          AND lower(email) = lower(@email)
        THEN 1
        ELSE 2
      END,
      id ASC
    LIMIT 1
  `);

  // ── INSERT ───────────────────────────────────────────────────────────

  const insertCandidateStatement = database.prepare<CreateCandidateInput>(`
    INSERT INTO candidates (user_id, name, email, phone, linkedin, github)
    VALUES (@user_id, @name, @email, @phone, @linkedin, @github)
  `);

  const insertResumeStatement = database.prepare<CreateResumeInput>(`
    INSERT INTO resumes (candidate_id, pdf_url)
    VALUES (@candidate_id, @pdf_url)
  `);

  const insertResumeAnalysisStatement = database.prepare<CreateResumeAnalysisInput>(`
    INSERT INTO resume_analyses (resume_id, skills, experience, projects, summary, score)
    VALUES (@resume_id, @skills, @experience, @projects, @summary, @score)
  `);

  // ── DELETE ───────────────────────────────────────────────────────────

  const deleteCandidateStatement = database.prepare<[number]>(
    "DELETE FROM candidates WHERE id = ?",
  );

  const deleteMessagesByCandidateIdStatement = database.prepare<[number]>(
    "DELETE FROM messages WHERE candidate_id = ?",
  );

  const deleteNotificationsByCandidateIdStatement = database.prepare<[number]>(
    "DELETE FROM notifications WHERE candidate_id = ?",
  );

  const deleteCandidateForUserStatement = database.prepare<[number, number]>(
    "DELETE FROM candidates WHERE id = ? AND user_id = ?",
  );

  const updateCandidateUserStatement = database.prepare<[number, number]>(
    "UPDATE candidates SET user_id = ? WHERE id = ?",
  );

  // ── Individual lookups for ID retrieval ──────────────────────────────

  const selectResumeByIdStatement = database.prepare<[number], Resume>(
    "SELECT id, candidate_id, pdf_url, uploaded_at FROM resumes WHERE id = ?",
  );

  const selectResumeAnalysisByIdStatement = database.prepare<
    [number],
    ResumeAnalysis
  >(
    "SELECT id, resume_id, skills, experience, projects, summary, score, created_at FROM resume_analyses WHERE id = ?",
  );

  const selectCandidateByIdBasicStatement = database.prepare<
    [number],
    Candidate
  >(
    "SELECT id, user_id, name, email, phone, linkedin, github, created_at FROM candidates WHERE id = ?",
  );

  // ── Repository Methods ───────────────────────────────────────────────

  const findOrCreateCandidate = (
    input: CreateCandidateInput,
  ): Candidate => {
    const lookupInput: CandidateLookupInput = {
      user_id: input.user_id ?? null,
      name: input.name,
      email: input.email ?? null,
    };

    const existingCandidate =
      selectExistingCandidateStatement.get(lookupInput);

    if (existingCandidate !== undefined) {
      repoLogger.debug("Candidate found by lookup", {
        candidateId: existingCandidate.id,
        name: existingCandidate.name,
      });
      return existingCandidate;
    }

    const result = insertCandidateStatement.run({
      user_id: input.user_id ?? null,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      github: input.github ?? null,
    });

    const newCandidate = selectCandidateByIdBasicStatement.get(
      Number(result.lastInsertRowid),
    ) as Candidate;

    repoLogger.info("Candidate created", {
      candidateId: newCandidate.id,
      name: newCandidate.name,
      userId: newCandidate.user_id,
    });

    return newCandidate;
  };

  const insertResume = (input: CreateResumeInput): Resume | undefined => {
    const result = insertResumeStatement.run(input);

    const resume = selectResumeByIdStatement.get(Number(result.lastInsertRowid));

    if (resume !== undefined) {
      repoLogger.debug("Resume record created", {
        resumeId: resume.id,
        candidateId: resume.candidate_id,
        hasPdf: resume.pdf_url !== null,
      });
    }

    return resume;
  };

  const insertResumeAnalysis = (
    input: CreateResumeAnalysisInput,
  ): ResumeAnalysis | undefined => {
    const result = insertResumeAnalysisStatement.run(input);

    const analysis = selectResumeAnalysisByIdStatement.get(
      Number(result.lastInsertRowid),
    );

    if (analysis !== undefined) {
      repoLogger.debug("Resume analysis created", {
        analysisId: analysis.id,
        resumeId: analysis.resume_id,
        score: analysis.score,
      });
    }

    return analysis;
  };

  const deleteCandidateWithRelatedRecords = database.transaction(
    (id: number): CandidateWithAnalysis | undefined => {
      // Capture the data before deletion
      const row = selectCandidateByIdStatement.get(id);

      if (row === undefined) return undefined;

      // Delete messages and notifications referencing this candidate
      deleteMessagesByCandidateIdStatement.run(id);
      deleteNotificationsByCandidateIdStatement.run(id);

      // Delete candidate — CASCADE on resumes → resume_analyses handles the rest
      const result = deleteCandidateStatement.run(id);

      const deleted = result.changes > 0;

      if (deleted) {
        repoLogger.info("Candidate deleted with related records", {
          candidateId: id,
        });
      }

      return deleted
        ? mapToCandidateWithAnalysis(row)
        : undefined;
    },
  ) as (id: number) => CandidateWithAnalysis | undefined;

  return {
    getCandidates: (): CandidateWithAnalysis[] =>
      selectCandidatesStatement
        .all()
        .map((row) => mapToCandidateWithAnalysis(row)),

    getCandidatesByUserId: (userId: number): CandidateWithAnalysis[] =>
      selectCandidatesByUserIdStatement
        .all(userId)
        .map((row) => mapToCandidateWithAnalysis(row)),

    getCandidateById: (id: number): CandidateWithAnalysis | undefined => {
      const row = selectCandidateByIdStatement.get(id);

      if (row === undefined) return undefined;

      return mapToCandidateWithAnalysis(row);
    },

    findOrCreateCandidate,
    insertResume,
    insertResumeAnalysis,
    deleteCandidate: (id: number): boolean => {
      const result = deleteCandidateStatement.run(id);
      const deleted = result.changes > 0;

      if (deleted) {
        repoLogger.info("Candidate deleted", { candidateId: id });
      }

      return deleted;
    },
    deleteCandidateWithRelatedRecords,
    deleteCandidateForUser: (id: number, userId: number): boolean => {
      const result = deleteCandidateForUserStatement.run(id, userId);
      const deleted = result.changes > 0;

      if (deleted) {
        repoLogger.info("Candidate deleted by user", { candidateId: id, userId });
      }

      return deleted;
    },

    updateCandidateUser: (candidateId: number, userId: number): void => {
      updateCandidateUserStatement.run(userId, candidateId);
      repoLogger.info("Candidate user claimed", { candidateId, userId });
    },
  };
};
