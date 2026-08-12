import type { Pool } from "pg";
import { newDb } from "pg-mem";

import { initializeDatabase } from "../../databaseSchema.js";

/**
 * Create an in-memory Postgres database (pg-mem) with the schema applied.
 * Mirrors the old `new Database(":memory:")` experience so tests never
 * need a running Postgres server.
 */
export const createTestDatabase = async (): Promise<Pool> => {
  const memDb = newDb();
  const pgAdapter = memDb.adapters.createPg();
  const pool = new pgAdapter.Pool() as unknown as Pool;

  await initializeDatabase(pool);

  return pool;
};

export const closeTestDatabase = async (pool: Pool): Promise<void> => {
  await pool.end();
};
