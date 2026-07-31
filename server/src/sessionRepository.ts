import type Database from "better-sqlite3";

import type { CreateSessionInput, Session } from "./db.js";

export interface SessionRepository {
  createSession: (input: CreateSessionInput) => Session | undefined;
  findByRefreshTokenHash: (hash: string) => Session | undefined;
  revokeSession: (sessionId: number) => void;
  revokeAllUserSessions: (userId: number) => void;
  revokeExpiredSessions: () => void;
}

export const createSessionRepository = (
  database: Database.Database,
): SessionRepository => {
  const insertSessionStatement = database.prepare<CreateSessionInput>(`
    INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
    VALUES (@user_id, @refresh_token_hash, @expires_at)
  `);

  const selectSessionByHashStatement = database.prepare<[string], Session>(`
    SELECT
      id,
      user_id,
      refresh_token_hash,
      expires_at,
      revoked,
      created_at
    FROM sessions
    WHERE refresh_token_hash = ?
      AND revoked = 0
      AND expires_at > datetime('now')
    LIMIT 1
  `);

  const selectSessionByIdStatement = database.prepare<[number], Session>(`
    SELECT
      id,
      user_id,
      refresh_token_hash,
      expires_at,
      revoked,
      created_at
    FROM sessions
    WHERE id = ?
  `);

  const revokeSessionStatement = database.prepare<[number]>(`
    UPDATE sessions
    SET revoked = 1
    WHERE id = ?
  `);

  const revokeAllUserSessionsStatement = database.prepare<[number]>(`
    UPDATE sessions
    SET revoked = 1
    WHERE user_id = ? AND revoked = 0
  `);

  const revokeExpiredSessionsStatement = database.prepare(`
    UPDATE sessions
    SET revoked = 1
    WHERE expires_at <= datetime('now') AND revoked = 0
  `);

  const createSession = (input: CreateSessionInput): Session | undefined => {
    const result = insertSessionStatement.run(input);

    return selectSessionByIdStatement.get(Number(result.lastInsertRowid));
  };

  return {
    createSession,
    findByRefreshTokenHash: (hash: string): Session | undefined =>
      selectSessionByHashStatement.get(hash),
    revokeSession: (sessionId: number): void => {
      revokeSessionStatement.run(sessionId);
    },
    revokeAllUserSessions: (userId: number): void => {
      revokeAllUserSessionsStatement.run(userId);
    },
    revokeExpiredSessions: (): void => {
      revokeExpiredSessionsStatement.run();
    },
  };
};
