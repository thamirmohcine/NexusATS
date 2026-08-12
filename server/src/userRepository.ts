import type { Pool } from "pg";

import type { CreateUserInput, User, UserRole } from "./db.js";

export interface UserRepository {
  createUser: (input: CreateUserInput) => Promise<User | undefined>;
  getUserByEmail: (email: string) => Promise<User | undefined>;
  getUserById: (id: number) => Promise<User | undefined>;
  getUsersByRole: (role: UserRole) => Promise<User[]>;
}

export const createUserRepository = (database: Pool): UserRepository => {
  const getUserById = async (id: number): Promise<User | undefined> => {
    const { rows } = await database.query<User>(
      `SELECT
        id,
        name,
        email,
        password,
        role,
        created_at
      FROM users
      WHERE id = $1`,
      [id],
    );

    return rows[0];
  };

  const getUserByEmail = async (email: string): Promise<User | undefined> => {
    const { rows } = await database.query<User>(
      `SELECT
        id,
        name,
        email,
        password,
        role,
        created_at
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1`,
      [email],
    );

    return rows[0];
  };

  const getUsersByRole = async (role: UserRole): Promise<User[]> => {
    const { rows } = await database.query<User>(
      `SELECT
        id,
        name,
        email,
        password,
        role,
        created_at
      FROM users
      WHERE role = $1
      ORDER BY created_at ASC, id ASC`,
      [role],
    );

    return rows;
  };

  const createUser = async (input: CreateUserInput): Promise<User | undefined> => {
    const { rows } = await database.query<User>(
      `INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, password, role, created_at`,
      [input.name, input.email, input.password, input.role],
    );

    return rows[0];
  };

  return {
    createUser,
    getUserByEmail,
    getUserById,
    getUsersByRole,
  };
};
