import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { initializeDatabase } from "../src/databaseSchema.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createUserRepository } from "../src/userRepository.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const startAuthServer = async (
  database: Database.Database,
): Promise<TestServer> => {
  const app = express();

  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      jwtSecret: "test-secret",
      userRepository: createUserRepository(database),
    }),
  );

  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
};

const postJson = (
  url: string,
  body: Record<string, unknown>,
): Promise<Response> =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJsonObject = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const body: unknown = await response.json();
  assert.ok(isRecord(body));

  return body;
};

test("auth routes register, login, and return the current user from a JWT", async () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const testServer = await startAuthServer(database);

  try {
    const registerResponse = await postJson(`${testServer.baseUrl}/api/auth/register`, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct-horse-battery-staple",
      role: "admin",
    });
    const registerBody = await readJsonObject(registerResponse);

    assert.equal(registerResponse.status, 201);
    assert.equal(typeof registerBody.token, "string");
    assert.ok(isRecord(registerBody.user));
    assert.equal(registerBody.user.name, "Ada Lovelace");
    assert.equal(registerBody.user.email, "ada@example.com");
    assert.equal(registerBody.user.role, "admin");
    assert.equal("password" in registerBody.user, false);

    const storedUser = database
      .prepare<[], { password: string }>("SELECT password FROM users LIMIT 1")
      .get();

    assert.notEqual(storedUser?.password, "correct-horse-battery-staple");
    assert.ok(storedUser?.password.startsWith("$2"));

    const loginResponse = await postJson(`${testServer.baseUrl}/api/auth/login`, {
      email: "ada@example.com",
      password: "correct-horse-battery-staple",
    });
    const loginBody = await readJsonObject(loginResponse);

    assert.equal(loginResponse.status, 200);
    assert.equal(typeof loginBody.token, "string");
    assert.ok(isRecord(loginBody.user));
    assert.equal(loginBody.user.email, "ada@example.com");
    assert.equal(loginBody.user.role, "admin");

    const meResponse = await fetch(`${testServer.baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginBody.token}`,
      },
    });
    const meBody = await readJsonObject(meResponse);

    assert.equal(meResponse.status, 200);
    assert.equal(meBody.email, "ada@example.com");
    assert.equal(meBody.role, "admin");
  } finally {
    await testServer.close();
    database.close();
  }
});

test("auth routes reject invalid login credentials and missing JWTs", async () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const testServer = await startAuthServer(database);

  try {
    await postJson(`${testServer.baseUrl}/api/auth/register`, {
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "compiler",
    });

    const loginResponse = await postJson(`${testServer.baseUrl}/api/auth/login`, {
      email: "grace@example.com",
      password: "wrong-password",
    });
    const loginBody = await readJsonObject(loginResponse);

    assert.equal(loginResponse.status, 401);
    assert.deepEqual(loginBody, { error: "Invalid email or password" });

    const meResponse = await fetch(`${testServer.baseUrl}/api/auth/me`);
    const meBody = await readJsonObject(meResponse);

    assert.equal(meResponse.status, 401);
    assert.deepEqual(meBody, { error: "Authorization token is required" });
  } finally {
    await testServer.close();
    database.close();
  }
});


test("auth routes return safe admin users for authenticated requests", async () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const testServer = await startAuthServer(database);

  try {
    const adminRegisterResponse = await postJson(
      `${testServer.baseUrl}/api/auth/register`,
      {
        name: "Ada Admin",
        email: "admin-list@example.com",
        password: "secret",
        role: "admin",
      },
    );
    const adminRegisterBody = await readJsonObject(adminRegisterResponse);

    await postJson(`${testServer.baseUrl}/api/auth/register`, {
      name: "Cara Candidate",
      email: "candidate-list@example.com",
      password: "secret",
      role: "candidate",
    });

    assert.equal(typeof adminRegisterBody.token, "string");

    const adminsResponse = await fetch(`${testServer.baseUrl}/api/auth/admins`, {
      headers: {
        Authorization: `Bearer ${adminRegisterBody.token}`,
      },
    });
    assert.equal(adminsResponse.status, 200);

    const adminsBody: unknown = await adminsResponse.json();

    assert.ok(Array.isArray(adminsBody));
    assert.equal(adminsBody.length, 1);
    assert.ok(isRecord(adminsBody[0]));
    assert.equal(adminsBody[0].name, "Ada Admin");
    assert.equal(adminsBody[0].email, "admin-list@example.com");
    assert.equal(adminsBody[0].role, "admin");
    assert.equal("password" in adminsBody[0], false);
  } finally {
    await testServer.close();
    database.close();
  }
});
