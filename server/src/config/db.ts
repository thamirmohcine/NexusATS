import pg from "pg";

import { initializeDatabase } from "../databaseSchema.js";

const { Pool } = pg;

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/screener";

// Keep timestamps as strings so the API contract (ISO strings) and the
// frontend `new Date(...)` parsing behave exactly as they did with SQLite.
// Without these parsers node-postgres would return Date objects.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value: string) => value);

export const db = new Pool({
  connectionString: databaseUrl,
});

export { initializeDatabase };
export default db;
