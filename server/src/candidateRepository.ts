import type Database from "better-sqlite3";

import type { Candidate, CreateCandidateInput } from "./db.js";

interface CandidateStorageInput {
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
}

interface CandidateLookupInput {
  user_id: number | null;
  name: string;
  email: string | null;
}

interface CandidateUpdateInput extends CandidateStorageInput {
  id: number;
}

const canUpdateExistingCandidate = (
  input: CreateCandidateInput,
  existingCandidate: Candidate,
): boolean =>
  input.user_id === undefined ||
  input.user_id === null ||
  existingCandidate.user_id === null ||
  existingCandidate.user_id === input.user_id;

export interface CandidateRepository {
  getCandidates: () => Candidate[];
  getCandidatesByUserId: (userId: number) => Candidate[];
  getCandidateById: (id: number) => Candidate | undefined;
  upsertCandidate: (input: CreateCandidateInput) => Candidate | undefined;
  deleteCandidate: (id: number) => boolean;
  deleteCandidateWithRelatedRecords: (id: number) => Candidate | undefined;
  deleteCandidateForUser: (id: number, userId: number) => boolean;
}

const toStorageInput = (
  input: CreateCandidateInput,
  existingCandidate?: Candidate,
): CandidateStorageInput => ({
  user_id: input.user_id ?? existingCandidate?.user_id ?? null,
  name: input.name,
  email: input.email ?? existingCandidate?.email ?? null,
  phone: input.phone ?? existingCandidate?.phone ?? null,
  linkedin: input.linkedin ?? existingCandidate?.linkedin ?? null,
  github: input.github ?? existingCandidate?.github ?? null,
  pdf_url: input.pdf_url ?? existingCandidate?.pdf_url ?? null,
  skills: input.skills ?? null,
  experience: input.experience ?? existingCandidate?.experience ?? null,
  projects: input.projects ?? existingCandidate?.projects ?? null,
  summary: input.summary ?? null,
  score: input.score ?? null,
});

export const createCandidateRepository = (
  database: Database.Database,
): CandidateRepository => {
  const selectCandidatesStatement = database.prepare<[], Candidate>(`
    SELECT id, user_id, name, email, phone, linkedin, github, pdf_url, skills, experience, projects, summary, score, created_at
    FROM candidates
    ORDER BY created_at DESC, id DESC
  `);

  const selectCandidateByIdStatement = database.prepare<[number], Candidate>(`
    SELECT id, user_id, name, email, phone, linkedin, github, pdf_url, skills, experience, projects, summary, score, created_at
    FROM candidates
    WHERE id = ?
  `);

  const selectCandidatesByUserIdStatement = database.prepare<[number], Candidate>(`
    SELECT id, user_id, name, email, phone, linkedin, github, pdf_url, skills, experience, projects, summary, score, created_at
    FROM candidates
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `);

  const selectExistingCandidateStatement = database.prepare<
    CandidateLookupInput,
    Candidate
  >(`
    SELECT id, user_id, name, email, phone, linkedin, github, pdf_url, skills, experience, projects, summary, score, created_at
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

  const insertCandidateStatement = database.prepare<CandidateStorageInput>(`
    INSERT INTO candidates (
      user_id,
      name,
      email,
      phone,
      linkedin,
      github,
      pdf_url,
      skills,
      experience,
      projects,
      summary,
      score
    )
    VALUES (
      @user_id,
      @name,
      @email,
      @phone,
      @linkedin,
      @github,
      @pdf_url,
      @skills,
      @experience,
      @projects,
      @summary,
      @score
    )
  `);

  const updateCandidateStatement = database.prepare<CandidateUpdateInput>(`
    UPDATE candidates
    SET user_id = @user_id,
        name = @name,
        email = @email,
        phone = @phone,
        linkedin = @linkedin,
        github = @github,
        pdf_url = @pdf_url,
        skills = @skills,
        experience = @experience,
        projects = @projects,
        summary = @summary,
        score = @score
    WHERE id = @id
  `);

  const deleteCandidateStatement = database.prepare<[number]>(`
    DELETE FROM candidates
    WHERE id = ?
  `);

  const deleteMessagesByCandidateIdStatement = database.prepare<[number]>(`
    DELETE FROM messages
    WHERE candidate_id = ?
  `);

  const deleteNotificationsByCandidateIdStatement = database.prepare<[number]>(`
    DELETE FROM notifications
    WHERE candidate_id = ?
  `);

  const deleteCandidateForUserStatement = database.prepare<[number, number]>(`
    DELETE FROM candidates
    WHERE id = ?
      AND user_id = ?
  `);

  const getCandidateById = (id: number): Candidate | undefined =>
    selectCandidateByIdStatement.get(id);

  const upsertCandidate = (
    input: CreateCandidateInput,
  ): Candidate | undefined => {
    const lookupInput: CandidateLookupInput = {
      user_id: input.user_id ?? null,
      name: input.name,
      email: input.email ?? null,
    };
    const existingCandidate = selectExistingCandidateStatement.get(lookupInput);

    if (
      existingCandidate !== undefined &&
      !canUpdateExistingCandidate(input, existingCandidate)
    ) {
      return undefined;
    }

    const storageInput = toStorageInput(input, existingCandidate);

    if (existingCandidate !== undefined) {
      updateCandidateStatement.run({
        id: existingCandidate.id,
        ...storageInput,
      });

      return getCandidateById(existingCandidate.id);
    }

    const result = insertCandidateStatement.run(storageInput);

    return getCandidateById(Number(result.lastInsertRowid));
  };

  const deleteCandidate = (id: number): boolean => {
    const result = deleteCandidateStatement.run(id);
    return result.changes > 0;
  };

  const deleteCandidateWithRelatedRecords = database.transaction(
    (id: number): Candidate | undefined => {
      const candidate = getCandidateById(id);

      if (candidate === undefined) {
        return undefined;
      }

      deleteMessagesByCandidateIdStatement.run(id);
      deleteNotificationsByCandidateIdStatement.run(id);

      const result = deleteCandidateStatement.run(id);
      return result.changes > 0 ? candidate : undefined;
    },
  );

  const deleteCandidateForUser = (id: number, userId: number): boolean => {
    const result = deleteCandidateForUserStatement.run(id, userId);
    return result.changes > 0;
  };

  return {
    getCandidates: () => selectCandidatesStatement.all(),
    getCandidatesByUserId: (userId: number): Candidate[] =>
      selectCandidatesByUserIdStatement.all(userId),
    getCandidateById,
    upsertCandidate,
    deleteCandidate,
    deleteCandidateWithRelatedRecords,
    deleteCandidateForUser,
  };
};
