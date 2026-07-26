import type Database from "better-sqlite3";

interface TableColumn {
  name: string;
}

const candidateColumnsToAdd = [
  { name: "user_id", definition: "INTEGER" },
  { name: "phone", definition: "TEXT" },
  { name: "linkedin", definition: "TEXT" },
  { name: "github", definition: "TEXT" },
  { name: "pdf_url", definition: "TEXT" },
  { name: "experience", definition: "TEXT" },
  { name: "projects", definition: "TEXT" },
] as const;

const messageColumnsToAdd = [
  { name: "is_read", definition: "INTEGER NOT NULL DEFAULT 0" },
] as const;

const notificationColumnsToAdd = [
  { name: "candidate_id", definition: "INTEGER" },
  { name: "sender_id", definition: "INTEGER" },
] as const;

const addMissingCandidateColumns = (database: Database.Database): void => {
  const existingColumns = new Set(
    database
      .prepare<[], TableColumn>("PRAGMA table_info(candidates)")
      .all()
      .map((column) => column.name),
  );

  for (const column of candidateColumnsToAdd) {
    if (!existingColumns.has(column.name)) {
      database.exec(
        `ALTER TABLE candidates ADD COLUMN ${column.name} ${column.definition};`,
      );
    }
  }
};

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

const deduplicateCandidates = (database: Database.Database): void => {
  database.exec(`
    DELETE FROM candidates
    WHERE email IS NOT NULL
      AND id NOT IN (
        SELECT MAX(id)
        FROM candidates
        WHERE email IS NOT NULL
        GROUP BY lower(email)
      );

    DELETE FROM candidates
    WHERE id NOT IN (
      SELECT MAX(id)
      FROM candidates
      GROUP BY lower(name)
    );
  `);
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

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE,
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

  addMissingCandidateColumns(database);
  addMissingMessageColumns(database);
  addMissingNotificationColumns(database);
  deduplicateCandidates(database);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
      ON users (lower(email));

    CREATE UNIQUE INDEX IF NOT EXISTS candidates_email_unique_idx
      ON candidates (lower(email))
      WHERE email IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS candidates_name_unique_idx
      ON candidates (lower(name));

    CREATE INDEX IF NOT EXISTS messages_candidate_created_idx
      ON messages (candidate_id, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
      ON notifications (user_id, is_read, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_role_unread_idx
      ON notifications (target_role, is_read, created_at, id);

    CREATE INDEX IF NOT EXISTS notifications_candidate_idx
      ON notifications (candidate_id, created_at, id);
  `);
};
