import Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeDatabase } from "../databaseSchema.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, "../..");

export const databasePath = resolve(serverDir, "screener.db");

export const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

initializeDatabase(db);

export default db;
