import type { Pool } from "pg";

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
  getCandidates: () => Promise<CandidateWithAnalysis[]>;
  getCandidatesByUserId: (userId: number) => Promise<CandidateWithAnalysis[]>;
  getCandidateById: (id: number) => Promise<CandidateWithAnalysis | undefined>;
  findOrCreateCandidate: (input: CreateCandidateInput) => Promise<Candidate>;
  insertResume: (input: CreateResumeInput) => Promise<Resume | undefined>;
  insertResumeAnalysis: (
    input: CreateResumeAnalysisInput,
  ) => Promise<ResumeAnalysis | undefined>;
  deleteCandidate: (id: number) => Promise<boolean>;
  deleteCandidateWithRelatedRecords: (
    id: number,
  ) => Promise<CandidateWithAnalysis | undefined>;
  deleteCandidateForUser: (id: number, userId: number) => Promise<boolean>;
  updateCandidateUser: (candidateId: number, userId: number) => Promise<void>;
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
  database: Pool,
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

  const selectCandidates = async (): Promise<CandidateWithAnalysis[]> => {
    const { rows } = await database.query<Record<string, unknown>>(
      `${candidatesWithAnalysisQuery}
       ORDER BY c.created_at DESC, c.id DESC`,
    );

    return rows.map((row) => mapToCandidateWithAnalysis(row));
  };

  const selectCandidatesByUserId = async (
    userId: number,
  ): Promise<CandidateWithAnalysis[]> => {
    const { rows } = await database.query<Record<string, unknown>>(
      `${candidatesWithAnalysisQuery}
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC, c.id DESC`,
      [userId],
    );

    return rows.map((row) => mapToCandidateWithAnalysis(row));
  };

  const selectCandidateById = async (
    id: number,
  ): Promise<CandidateWithAnalysis | undefined> => {
    const { rows } = await database.query<Record<string, unknown>>(
      `${candidatesWithAnalysisQuery}
       WHERE c.id = $1`,
      [id],
    );

    const row = rows[0];

    return row === undefined ? undefined : mapToCandidateWithAnalysis(row);
  };

  // ── Find existing candidate by user_id / email / name match ──────────

  const selectExistingCandidate = async (
    input: CandidateLookupInput,
  ): Promise<Candidate | undefined> => {
    const { rows } = await database.query<Candidate>(
      `SELECT id, user_id, name, email, phone, linkedin, github, created_at
      FROM candidates
      WHERE (
          $1::int IS NOT NULL
          AND user_id = $1
        )
        OR (
          $2::text IS NOT NULL
          AND email IS NOT NULL
          AND lower(email) = lower($2)
        )
        OR (
          $2::text IS NULL
          AND lower(name) = lower($3)
        )
      ORDER BY
        CASE
          WHEN $1::int IS NOT NULL
            AND user_id = $1
          THEN 0
          WHEN $2::text IS NOT NULL
            AND email IS NOT NULL
            AND lower(email) = lower($2)
          THEN 1
          ELSE 2
        END,
        id ASC
      LIMIT 1`,
      [input.user_id, input.email, input.name],
    );

    return rows[0];
  };

  // ── INSERT ───────────────────────────────────────────────────────────

  const insertCandidate = async (
    input: CreateCandidateInput,
  ): Promise<Candidate | undefined> => {
    const { rows } = await database.query<Candidate>(
      `INSERT INTO candidates (user_id, name, email, phone, linkedin, github)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, name, email, phone, linkedin, github, created_at`,
      [
        input.user_id ?? null,
        input.name,
        input.email ?? null,
        input.phone ?? null,
        input.linkedin ?? null,
        input.github ?? null,
      ],
    );

    return rows[0];
  };

  const insertResume = async (
    input: CreateResumeInput,
  ): Promise<Resume | undefined> => {
    const { rows } = await database.query<Resume>(
      `INSERT INTO resumes (candidate_id, pdf_url)
      VALUES ($1, $2)
      RETURNING id, candidate_id, pdf_url, uploaded_at`,
      [input.candidate_id, input.pdf_url],
    );

    return rows[0];
  };

  const insertResumeAnalysis = async (
    input: CreateResumeAnalysisInput,
  ): Promise<ResumeAnalysis | undefined> => {
    const { rows } = await database.query<ResumeAnalysis>(
      `INSERT INTO resume_analyses (resume_id, skills, experience, projects, summary, score)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, resume_id, skills, experience, projects, summary, score, created_at`,
      [
        input.resume_id,
        input.skills,
        input.experience,
        input.projects,
        input.summary,
        input.score,
      ],
    );

    return rows[0];
  };

  // ── DELETE ───────────────────────────────────────────────────────────

  const deleteCandidate = async (id: number): Promise<boolean> => {
    const result = await database.query("DELETE FROM candidates WHERE id = $1", [
      id,
    ]);

    const deleted = (result.rowCount ?? 0) > 0;

    if (deleted) {
      repoLogger.info("Candidate deleted", { candidateId: id });
    }

    return deleted;
  };

  const deleteCandidateForUser = async (
    id: number,
    userId: number,
  ): Promise<boolean> => {
    const result = await database.query(
      "DELETE FROM candidates WHERE id = $1 AND user_id = $2",
      [id, userId],
    );

    const deleted = (result.rowCount ?? 0) > 0;

    if (deleted) {
      repoLogger.info("Candidate deleted by user", { candidateId: id, userId });
    }

    return deleted;
  };

  const deleteCandidateWithRelatedRecords = async (
    id: number,
  ): Promise<CandidateWithAnalysis | undefined> => {
    const client = await database.connect();

    try {
      await client.query("BEGIN");

      // Capture the data before deletion
      const selectResult = await client.query<Record<string, unknown>>(
        `${candidatesWithAnalysisQuery}
         WHERE c.id = $1`,
        [id],
      );

      const row = selectResult.rows[0];

      if (row === undefined) {
        await client.query("ROLLBACK");
        return undefined;
      }

      // Delete messages and notifications referencing this candidate
      await client.query("DELETE FROM messages WHERE candidate_id = $1", [id]);
      await client.query("DELETE FROM notifications WHERE candidate_id = $1", [
        id,
      ]);

      // Delete candidate — CASCADE on resumes → resume_analyses handles the rest
      const deleteResult = await client.query(
        "DELETE FROM candidates WHERE id = $1",
        [id],
      );

      await client.query("COMMIT");

      const deleted = (deleteResult.rowCount ?? 0) > 0;

      if (deleted) {
        repoLogger.info("Candidate deleted with related records", {
          candidateId: id,
        });
      }

      return deleted ? mapToCandidateWithAnalysis(row) : undefined;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };

  const updateCandidateUser = async (
    candidateId: number,
    userId: number,
  ): Promise<void> => {
    await database.query(
      "UPDATE candidates SET user_id = $1 WHERE id = $2",
      [userId, candidateId],
    );
    repoLogger.info("Candidate user claimed", { candidateId, userId });
  };

  // ── Repository Methods ───────────────────────────────────────────────

  const findOrCreateCandidate = async (
    input: CreateCandidateInput,
  ): Promise<Candidate> => {
    const lookupInput: CandidateLookupInput = {
      user_id: input.user_id ?? null,
      name: input.name,
      email: input.email ?? null,
    };

    const existingCandidate = await selectExistingCandidate(lookupInput);

    if (existingCandidate !== undefined) {
      repoLogger.debug("Candidate found by lookup", {
        candidateId: existingCandidate.id,
        name: existingCandidate.name,
      });
      return existingCandidate;
    }

    const newCandidate = await insertCandidate({
      user_id: input.user_id ?? null,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      github: input.github ?? null,
    });

    if (newCandidate === undefined) {
      throw new Error("Failed to create candidate");
    }

    repoLogger.info("Candidate created", {
      candidateId: newCandidate.id,
      name: newCandidate.name,
      userId: newCandidate.user_id,
    });

    return newCandidate;
  };

  return {
    getCandidates: selectCandidates,
    getCandidatesByUserId: selectCandidatesByUserId,
    getCandidateById: selectCandidateById,
    findOrCreateCandidate,
    insertResume,
    insertResumeAnalysis,
    deleteCandidate,
    deleteCandidateWithRelatedRecords,
    deleteCandidateForUser,
    updateCandidateUser,
  };
};
