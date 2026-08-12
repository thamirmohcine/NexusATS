import type { Pool } from "pg";

import type { CreateSessionInput, Session } from "./db.js";

export interface SessionRepository {
  createSession: (input: CreateSessionInput) => Promise<Session | undefined>;
  findByRefreshTokenHash: (hash: string) => Promise<Session | undefined>;
  revokeSession: (sessionId: number) => Promise<void>;
  revokeAllUserSessions: (userId: number) => Promise<void>;
  revokeExpiredSessions: () => Promise<void>;
}

export const createSessionRepository = (database: Pool): SessionRepository => {
  const createSession = async (
    input: CreateSessionInput,
  ): Promise<Session | undefined> => {
    const { rows } = await database.query<Session>(
      `INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, refresh_token_hash, expires_at, revoked, created_at`,
      [input.user_id, input.refresh_token_hash, input.expires_at],
    );

    return rows[0];
  };

  const findByRefreshTokenHash = async (
    hash: string,
  ): Promise<Session | undefined> => {
    const { rows } = await database.query<Session>(
      `SELECT
        id,
        user_id,
        refresh_token_hash,
        expires_at,
        revoked,
        created_at
      FROM sessions
      WHERE refresh_token_hash = $1
        AND revoked = 0
        AND expires_at > NOW()
      LIMIT 1`,
      [hash],
    );

    return rows[0];
  };

  const revokeSession = async (sessionId: number): Promise<void> => {
    await database.query(`UPDATE sessions SET revoked = 1 WHERE id = $1`, [
      sessionId,
    ]);
  };

  const revokeAllUserSessions = async (userId: number): Promise<void> => {
    await database.query(
      `UPDATE sessions SET revoked = 1 WHERE user_id = $1 AND revoked = 0`,
      [userId],
    );
  };

  const revokeExpiredSessions = async (): Promise<void> => {
    await database.query(
      `UPDATE sessions SET revoked = 1 WHERE expires_at <= NOW() AND revoked = 0`,
    );
  };

  return {
    createSession,
    findByRefreshTokenHash,
    revokeSession,
    revokeAllUserSessions,
    revokeExpiredSessions,
  };
};
