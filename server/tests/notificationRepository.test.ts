import assert from "node:assert/strict";
import test from "node:test";

import type { Pool } from "pg";

import {
  createNotificationRepository,
  type CreateNotificationInput,
} from "../src/notificationRepository.js";
import type { UserRole } from "../src/db.js";
import { closeTestDatabase, createTestDatabase } from "../src/__tests__/helpers/testDatabase.js";

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

const insertUser = async (
  database: Pool,
  role: UserRole,
  email: string,
): Promise<number> => {
  const { rows } = await database.query<{ id: string }>(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [`${role} user`, email, "hashed-password", role],
  );

  return Number(rows[0]?.id);
};

const insertCandidate = async (
  database: Pool,
  userId: number,
  name: string,
  email: string,
): Promise<number> => {
  const { rows } = await database.query<{ id: string }>(
    "INSERT INTO candidates (user_id, name, email) VALUES ($1, $2, $3) RETURNING id",
    [userId, name, email],
  );

  return Number(rows[0]?.id);
};

test("notification repository creates and returns unread admin notifications", async () => {
  const database = await createTestDatabase();

  try {
    const repository = createNotificationRepository(database);
    const adminId = await insertUser(database, "admin", "admin-notify@example.com");
    const candidateId = await insertUser(
      database,
      "candidate",
      "candidate-notify@example.com",
    );
    const candidateProfileId = await insertCandidate(
      database,
      candidateId,
      "Notification Candidate",
      "notification-profile@example.com",
    );

    const adminRoleNotification = await repository.createNotification(createInput());
    const directCandidateNotification = await repository.createNotification(
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

    const adminNotifications = await repository.getUnreadNotificationsForUser({
      id: adminId,
      role: "admin",
    });
    const candidateNotifications = await repository.getUnreadNotificationsForUser({
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
  } finally {
    await closeTestDatabase(database);
  }
});

test("notification repository marks one current user notification as read", async () => {
  const database = await createTestDatabase();

  try {
    const repository = createNotificationRepository(database);
    const adminId = await insertUser(database, "admin", "admin-single-read@example.com");
    const firstCandidateUserId = await insertUser(
      database,
      "candidate",
      "first-single-read@example.com",
    );
    const secondCandidateUserId = await insertUser(
      database,
      "candidate",
      "second-single-read@example.com",
    );
    const firstCandidateProfileId = await insertCandidate(
      database,
      firstCandidateUserId,
      "First Single Read Candidate",
      "first-single-profile@example.com",
    );
    const secondCandidateProfileId = await insertCandidate(
      database,
      secondCandidateUserId,
      "Second Single Read Candidate",
      "second-single-profile@example.com",
    );

    const firstNotification = await repository.createNotification(
      createInput({
        candidate_id: firstCandidateProfileId,
        sender_id: firstCandidateUserId,
      }),
    );
    const secondNotification = await repository.createNotification(
      createInput({
        title: "Another application",
        content: "Another candidate submitted a resume.",
        candidate_id: secondCandidateProfileId,
        sender_id: secondCandidateUserId,
      }),
    );

    assert.notEqual(firstNotification, undefined);
    assert.notEqual(secondNotification, undefined);

    const readCount = await repository.markNotificationAsReadForUser(
      firstNotification?.id ?? 0,
      {
        id: adminId,
        role: "admin",
      },
    );
    const adminNotifications = await repository.getUnreadNotificationsForUser({
      id: adminId,
      role: "admin",
    });

    assert.equal(readCount, 1);
    assert.deepEqual(
      adminNotifications.map((notification) => notification.id),
      [secondNotification?.id],
    );
  } finally {
    await closeTestDatabase(database);
  }
});

test("notification repository marks current user notifications as read", async () => {
  const database = await createTestDatabase();

  try {
    const repository = createNotificationRepository(database);
    const adminId = await insertUser(database, "admin", "admin-read@example.com");
    const candidateId = await insertUser(database, "candidate", "candidate-read@example.com");

    await repository.createNotification(createInput());
    await repository.createNotification(
      createInput({
        user_id: candidateId,
        target_role: null,
        type: "message",
        title: "Candidate direct message",
        content: "This is for one candidate.",
      }),
    );

    const readCount = await repository.markUnreadNotificationsAsReadForUser({
      id: adminId,
      role: "admin",
    });

    assert.equal(readCount, 1);
    assert.equal(
      (await repository.getUnreadNotificationsForUser({ id: adminId, role: "admin" }))
        .length,
      0,
    );
    assert.equal(
      (await repository.getUnreadNotificationsForUser({
        id: candidateId,
        role: "candidate",
      })).length,
      1,
    );
  } finally {
    await closeTestDatabase(database);
  }
});
