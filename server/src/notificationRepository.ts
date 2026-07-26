import type Database from "better-sqlite3";

import type {
  CreateNotificationInput,
  Notification,
  UserRole,
} from "./db.js";

interface NotificationStorageInput {
  user_id: number | null;
  target_role: UserRole | null;
  candidate_id: number | null;
  sender_id: number | null;
  type: string;
  title: string;
  content: string;
}

interface NotificationUserScope {
  id: number;
  role: UserRole;
}

interface NotificationReadScope extends NotificationUserScope {
  notification_id: number;
}

export type { CreateNotificationInput };

export interface NotificationRepository {
  createNotification: (
    input: CreateNotificationInput,
  ) => Notification | undefined;
  getUnreadNotificationsForUser: (user: NotificationUserScope) => Notification[];
  markNotificationAsReadForUser: (
    notificationId: number,
    user: NotificationUserScope,
  ) => number;
  markUnreadNotificationsAsReadForUser: (user: NotificationUserScope) => number;
}

const toStorageInput = (
  input: CreateNotificationInput,
): NotificationStorageInput => ({
  user_id: input.user_id ?? null,
  target_role: input.target_role ?? null,
  candidate_id: input.candidate_id ?? null,
  sender_id: input.sender_id ?? null,
  type: input.type,
  title: input.title,
  content: input.content,
});

export const createNotificationRepository = (
  database: Database.Database,
): NotificationRepository => {
  const selectNotificationByIdStatement = database.prepare<
    [number],
    Notification
  >(`
    SELECT
      id,
      user_id,
      target_role,
      candidate_id,
      sender_id,
      type,
      title,
      content,
      is_read,
      created_at
    FROM notifications
    WHERE id = ?
  `);

  const insertNotificationStatement =
    database.prepare<NotificationStorageInput>(`
      INSERT INTO notifications (
        user_id,
        target_role,
        candidate_id,
        sender_id,
        type,
        title,
        content
      )
      VALUES (
        @user_id,
        @target_role,
        @candidate_id,
        @sender_id,
        @type,
        @title,
        @content
      )
    `);

  const selectUnreadNotificationsStatement = database.prepare<
    NotificationUserScope,
    Notification
  >(`
    SELECT
      id,
      user_id,
      target_role,
      candidate_id,
      sender_id,
      type,
      title,
      content,
      is_read,
      created_at
    FROM notifications
    WHERE is_read = 0
      AND (
        user_id = @id
        OR (
          @role = 'admin'
          AND target_role = 'admin'
        )
      )
    ORDER BY created_at DESC, id DESC
  `);

  const markNotificationAsReadStatement =
    database.prepare<NotificationReadScope>(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = @notification_id
        AND is_read = 0
        AND (
          user_id = @id
          OR (
            @role = 'admin'
            AND target_role = 'admin'
          )
        )
    `);

  const markUnreadNotificationsAsReadStatement =
    database.prepare<NotificationUserScope>(`
      UPDATE notifications
      SET is_read = 1
      WHERE is_read = 0
        AND (
          user_id = @id
          OR (
            @role = 'admin'
            AND target_role = 'admin'
          )
        )
    `);

  return {
    createNotification: (
      input: CreateNotificationInput,
    ): Notification | undefined => {
      const result = insertNotificationStatement.run(toStorageInput(input));

      return selectNotificationByIdStatement.get(Number(result.lastInsertRowid));
    },
    getUnreadNotificationsForUser: (
      user: NotificationUserScope,
    ): Notification[] => selectUnreadNotificationsStatement.all(user),
    markNotificationAsReadForUser: (
      notificationId: number,
      user: NotificationUserScope,
    ): number =>
      markNotificationAsReadStatement.run({
        notification_id: notificationId,
        ...user,
      }).changes,
    markUnreadNotificationsAsReadForUser: (
      user: NotificationUserScope,
    ): number => markUnreadNotificationsAsReadStatement.run(user).changes,
  };
};
