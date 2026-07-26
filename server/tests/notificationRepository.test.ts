import assert from "node:assert/strict";
import test from "node:test";

import Database from "better-sqlite3";

import { initializeDatabase } from "../src/databaseSchema.js";
import {
  createNotificationRepository,
  type CreateNotificationInput,
} from "../src/notificationRepository.js";
import type { UserRole } from "../src/db.js";

const createInput = (
  overrides: Partial<CreateNotificationInput> = {},
): CreateNotificationInput => ({
  user_id: null,
  target_role: "admin",
  type: "candidate_application",
  title: "New candidate application",
  content: "Maya Chen submitted a resume.",
  ...overrides,
});

const insertUser = (
  database: Database.Database,
  role: UserRole,
  email: string,
): number => {
  const result = database
    .prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    )
    .run(`${role} user`, email, "hashed-password", role);

  return Number(result.lastInsertRowid);
};

const insertCandidate = (
  database: Database.Database,
  userId: number,
  name: string,
  email: string,
): number => {
  const result = database
    .prepare(
      "INSERT INTO candidates (user_id, name, email) VALUES (?, ?, ?)",
    )
    .run(userId, name, email);

  return Number(result.lastInsertRowid);
};

test("notification repository creates and returns unread admin notifications", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createNotificationRepository(database);
  const adminId = insertUser(database, "admin", "admin-notify@example.com");
  const candidateId = insertUser(
    database,
    "candidate",
    "candidate-notify@example.com",
  );
  const candidateProfileId = insertCandidate(
    database,
    candidateId,
    "Notification Candidate",
    "notification-profile@example.com",
  );

  const adminRoleNotification = repository.createNotification(createInput());
  const directCandidateNotification = repository.createNotification(
    createInput({
      user_id: candidateId,
      target_role: null,
      type: "message",
      title: "New message",
      content: "An admin sent you a message.",
      candidate_id: candidateProfileId,
      sender_id: adminId,
    }),
  );

  assert.notEqual(adminRoleNotification, undefined);
  assert.notEqual(directCandidateNotification, undefined);
  assert.equal(adminRoleNotification?.is_read, 0);
  assert.equal(directCandidateNotification?.candidate_id, candidateProfileId);
  assert.equal(directCandidateNotification?.sender_id, adminId);

  const adminNotifications = repository.getUnreadNotificationsForUser({
    id: adminId,
    role: "admin",
  });
  const candidateNotifications = repository.getUnreadNotificationsForUser({
    id: candidateId,
    role: "candidate",
  });

  assert.deepEqual(
    adminNotifications.map((notification) => notification.title),
    ["New candidate application"],
  );
  assert.deepEqual(
    candidateNotifications.map((notification) => notification.title),
    ["New message"],
  );

  database.close();
});

test("notification repository marks one current user notification as read", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createNotificationRepository(database);
  const adminId = insertUser(database, "admin", "admin-single-read@example.com");
  const firstCandidateUserId = insertUser(
    database,
    "candidate",
    "first-single-read@example.com",
  );
  const secondCandidateUserId = insertUser(
    database,
    "candidate",
    "second-single-read@example.com",
  );
  const firstCandidateProfileId = insertCandidate(
    database,
    firstCandidateUserId,
    "First Single Read Candidate",
    "first-single-profile@example.com",
  );
  const secondCandidateProfileId = insertCandidate(
    database,
    secondCandidateUserId,
    "Second Single Read Candidate",
    "second-single-profile@example.com",
  );

  const firstNotification = repository.createNotification(
    createInput({
      candidate_id: firstCandidateProfileId,
      sender_id: firstCandidateUserId,
    }),
  );
  const secondNotification = repository.createNotification(
    createInput({
      title: "Another application",
      content: "Another candidate submitted a resume.",
      candidate_id: secondCandidateProfileId,
      sender_id: secondCandidateUserId,
    }),
  );

  assert.notEqual(firstNotification, undefined);
  assert.notEqual(secondNotification, undefined);

  const readCount = repository.markNotificationAsReadForUser(
    firstNotification?.id ?? 0,
    {
      id: adminId,
      role: "admin",
    },
  );
  const adminNotifications = repository.getUnreadNotificationsForUser({
    id: adminId,
    role: "admin",
  });

  assert.equal(readCount, 1);
  assert.deepEqual(
    adminNotifications.map((notification) => notification.id),
    [secondNotification?.id],
  );

  database.close();
});

test("notification repository marks current user notifications as read", () => {
  const database = new Database(":memory:");
  initializeDatabase(database);
  const repository = createNotificationRepository(database);
  const adminId = insertUser(database, "admin", "admin-read@example.com");
  const candidateId = insertUser(database, "candidate", "candidate-read@example.com");

  repository.createNotification(createInput());
  repository.createNotification(
    createInput({
      user_id: candidateId,
      target_role: null,
      type: "message",
      title: "Candidate direct message",
      content: "This is for one candidate.",
    }),
  );

  const readCount = repository.markUnreadNotificationsAsReadForUser({
    id: adminId,
    role: "admin",
  });

  assert.equal(readCount, 1);
  assert.equal(
    repository.getUnreadNotificationsForUser({ id: adminId, role: "admin" })
      .length,
    0,
  );
  assert.equal(
    repository.getUnreadNotificationsForUser({
      id: candidateId,
      role: "candidate",
    }).length,
    1,
  );

  database.close();
});
