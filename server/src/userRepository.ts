import type Database from "better-sqlite3";

import type { CreateUserInput, User, UserRole } from "./db.js";

interface UserEmailLookupInput {
  email: string;
}

export interface UserRepository {
  createUser: (input: CreateUserInput) => User | undefined;
  getUserByEmail: (email: string) => User | undefined;
  getUserById: (id: number) => User | undefined;
  getUsersByRole: (role: UserRole) => User[];
}

export const createUserRepository = (
  database: Database.Database,
): UserRepository => {
  const selectUserByIdStatement = database.prepare<[number], User>(`
    SELECT
      id,
      name,
      email,
      password,
      role,
      created_at
    FROM users
    WHERE id = ?
  `);

  const selectUserByEmailStatement = database.prepare<UserEmailLookupInput, User>(`
    SELECT
      id,
      name,
      email,
      password,
      role,
      created_at
    FROM users
    WHERE lower(email) = lower(@email)
    LIMIT 1
  `);

  const selectUsersByRoleStatement = database.prepare<[UserRole], User>(`
    SELECT
      id,
      name,
      email,
      password,
      role,
      created_at
    FROM users
    WHERE role = ?
    ORDER BY created_at ASC, id ASC
  `);

  const insertUserStatement = database.prepare<CreateUserInput>(`
    INSERT INTO users (name, email, password, role)
    VALUES (@name, @email, @password, @role)
  `);

  const getUserById = (id: number): User | undefined =>
    selectUserByIdStatement.get(id);

  const createUser = (input: CreateUserInput): User | undefined => {
    const result = insertUserStatement.run(input);

    return getUserById(Number(result.lastInsertRowid));
  };

  return {
    createUser,
    getUserByEmail: (email: string): User | undefined =>
      selectUserByEmailStatement.get({ email }),
    getUserById,
    getUsersByRole: (role: UserRole): User[] =>
      selectUsersByRoleStatement.all(role),
  };
};
