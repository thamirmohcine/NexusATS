import type { Pool } from "pg";

import { createLogger } from "./services/logger.js";

const logger = createLogger({
  level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ?? "info",
}).child({ module: "DatabaseSchema" });

/** Run a schema statement, tolerating unsupported engine edge cases. */
const safeExec = async (database: Pool, sql: string): Promise<void> => {
  try {
    await database.query(sql);
  } catch (error) {
    logger.warn("Schema statement failed (skipped)", {
      statement: sql.slice(0, 120),
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'candidate' CHECK (role IN ('candidate', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    linkedin TEXT,
    github TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    pdf_url TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS resume_analyses (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    skills TEXT,
    experience TEXT,
    projects TEXT,
    summary TEXT,
    score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    target_role TEXT CHECK (target_role IS NULL OR target_role IN ('candidate', 'admin')),
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
] as const;

const indexStatements = [
  "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (lower(email))",
  "CREATE UNIQUE INDEX IF NOT EXISTS candidates_email_unique_idx ON candidates (lower(email)) WHERE email IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS candidates_user_id_idx ON candidates (user_id)",
  "CREATE INDEX IF NOT EXISTS resumes_candidate_id_idx ON resumes (candidate_id)",
  "CREATE INDEX IF NOT EXISTS resume_analyses_resume_id_idx ON resume_analyses (resume_id)",
  "CREATE INDEX IF NOT EXISTS messages_candidate_created_idx ON messages (candidate_id, created_at, id)",
  "CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read, created_at, id)",
  "CREATE INDEX IF NOT EXISTS notifications_role_unread_idx ON notifications (target_role, is_read, created_at, id)",
  "CREATE INDEX IF NOT EXISTS notifications_candidate_idx ON notifications (candidate_id, created_at, id)",
  "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id, revoked, expires_at)",
  "CREATE INDEX IF NOT EXISTS sessions_hash_idx ON sessions (refresh_token_hash)",
] as const;

export const initializeDatabase = async (database: Pool): Promise<void> => {
  for (const statement of createTableStatements) {
    await database.query(statement);
  }

  // Additive migrations — keep existing databases in sync with the schema.
  await safeExec(
    database,
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read INTEGER NOT NULL DEFAULT 0",
  );
  await safeExec(
    database,
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS candidate_id INTEGER",
  );
  await safeExec(
    database,
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id INTEGER",
  );

  // Expression and partial indexes guarantee case-insensitive unique emails.
  // Each statement is isolated so a single failure (e.g. in emulated
  // engines) never blocks the rest of the schema.
  for (const statement of indexStatements) {
    await safeExec(database, statement);
  }
};
