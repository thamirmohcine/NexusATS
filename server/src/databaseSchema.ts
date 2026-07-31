import type Database from "better-sqlite3";

interface TableColumn {
  name: string;
}

const messageColumnsToAdd = [
  { name: "is_read", definition: "INTEGER NOT NULL DEFAULT 0" },
] as const;

const notificationColumnsToAdd = [
  { name: "candidate_id", definition: "INTEGER" },
  { name: "sender_id", definition: "INTEGER" },
] as const;

const addMissingMessageColumns = (database: Database.Database): void => {
  const existingColumns = new Set(
    database
      .prepare<[], TableColumn>("PRAGMA table_info(messages)")
      .all()
      .map((column) => column.name),
  );

  for (const column of messageColumnsToAdd) {
    if (!existingColumns.has(column.name)) {
      database.exec(
        `ALTER TABLE messages ADD COLUMN ${column.name} ${column.definition};`,
      );
    }
  }
};

const addMissingNotificationColumns = (database: Database.Database): void => {
  const existingColumns = new Set(
    database
      .prepare<[], TableColumn>("PRAGMA table_info(notifications)")
      .all()
      .map((column) => column.name),
  );

  for (const column of notificationColumnsToAdd) {
    if (!existingColumns.has(column.name)) {
      database.exec(
        `ALTER TABLE notifications ADD COLUMN ${column.name} ${column.definition};`,
      );
    }
  }
};

/**
 * Migrate data from the old flat candidates schema to the normalized
 * 3-table schema (candidates + resumes + resume_analyses).
 *
 * This runs once when the new tables are empty and the old candidates
 * table still has analysis-related columns (skills, experience, etc.).
 */
const migrateFromOldSchema = (database: Database.Database): void => {
  const resumeCount = database
    .prepare("SELECT COUNT(*) AS count FROM resumes")
    .get() as { count: number };

  if (resumeCount.count > 0) return;

  // Migrate old candidate rows that have data
  interface OldCandidateRow {
    id: number;
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

  const insertResume = database.prepare<
    [number, string | null],
    void
  >("INSERT INTO resumes (candidate_id, pdf_url) VALUES (?, ?)");

  const insertAnalysis = database.prepare<
    [number, string | null, string | null, string | null, string | null, number | null],
    void
  >(
    `INSERT INTO resume_analyses (resume_id, skills, experience, projects, summary, score)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  // Build SELECT dynamically based on existing columns (legacy candidate
  // tables may have been created with different column sets).
  const oldColumns = new Set(
    database
      .prepare<[], TableColumn>("PRAGMA table_info(candidates)")
      .all()
      .map((column) => column.name),
  );

  const columnOrDefault = (name: string): string =>
    oldColumns.has(name) ? name : `NULL AS ${name}`;

  const migrationSelectColumns = [
    "id",
    columnOrDefault("user_id"),
    "name",
    "email",
    columnOrDefault("phone"),
    columnOrDefault("linkedin"),
    columnOrDefault("github"),
    columnOrDefault("pdf_url"),
    columnOrDefault("skills"),
    columnOrDefault("experience"),
    columnOrDefault("projects"),
    columnOrDefault("summary"),
    columnOrDefault("score"),
  ].join(", ");

  // Build WHERE clause dynamically — only reference existing columns
  const whereConditions: string[] = [];
  const columnsToCheck = [
    ...((oldColumns.has("pdf_url") ? ["pdf_url"] : [])),
    ...((oldColumns.has("skills") ? ["skills"] : [])),
    ...((oldColumns.has("experience") ? ["experience"] : [])),
    ...((oldColumns.has("projects") ? ["projects"] : [])),
    ...((oldColumns.has("summary") ? ["summary"] : [])),
    ...((oldColumns.has("score") ? ["score"] : [])),
  ] as const;

  for (const column of columnsToCheck) {
    whereConditions.push(`${column} IS NOT NULL`);
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" OR ")}` : "";

  // Only migrate candidates that have a PDF URL or analysis data
  const oldCandidatesWithData = database
    .prepare<[], OldCandidateRow>(
      `SELECT ${migrationSelectColumns}
       FROM candidates
       ${whereClause}`,
    )
    .all();

  if (oldCandidatesWithData.length === 0) return;

  for (const oldCandidate of oldCandidatesWithData) {
    insertResume.run(oldCandidate.id, oldCandidate.pdf_url);
    const resumeId = Number(
      (database.prepare("SELECT last_insert_rowid() as id").get() as { id: number }).id,
    );

    insertAnalysis.run(
      resumeId,
      oldCandidate.skills,
      oldCandidate.experience,
      oldCandidate.projects,
      oldCandidate.summary,
      oldCandidate.score,
    );
  }
};

export const initializeDatabase = (database: Database.Database): void => {
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'candidate' CHECK (role IN ('candidate', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      linkedin TEXT,
      github TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      pdf_url TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resume_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      skills TEXT,
      experience TEXT,
      projects TEXT,
      summary TEXT,
      score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      target_role TEXT CHECK (target_role IS NULL OR target_role IN ('candidate', 'admin')),
      candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL,
      sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addMissingMessageColumns(database);
  addMissingNotificationColumns(database);
  migrateFromOldSchema(database);

  // Deduplicate candidates by email before creating unique index
  try {
    database.exec(`
      DELETE FROM candidates
      WHERE email IS NOT NULL
        AND id NOT IN (
          SELECT id
          FROM (
            SELECT MIN(id) AS id
            FROM candidates
            WHERE email IS NOT NULL
            GROUP BY lower(email)
          )
        );
    `);
  } catch {
    // If dedup fails (e.g. the 'email' column doesn't exist yet), skip
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
      ON users (lower(email));

    CREATE UNIQUE INDEX IF NOT EXISTS candidates_email_unique_idx
      ON candidates (lower(email))
      WHERE email IS NOT NULL;

    CREATE INDEX IF NOT EXISTS candidates_user_id_idx
      ON candidates (user_id);

    CREATE INDEX IF NOT EXISTS resumes_candidate_id_idx
      ON resumes (candidate_id);

    CREATE INDEX IF NOT EXISTS resume_analyses_resume_id_idx
      ON resume_analyses (resume_id);

    CREATE INDEX IF NOT EXISTS messages_candidate_created_idx
      ON messages (candidate_id, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
      ON notifications (user_id, is_read, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_role_unread_idx
      ON notifications (target_role, is_read, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_candidate_idx
      ON notifications (candidate_id, created_at, id);

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx
      ON sessions (user_id, revoked, expires_at);

    CREATE INDEX IF NOT EXISTS sessions_hash_idx
      ON sessions (refresh_token_hash);
  `);
};
