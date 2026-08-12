import type { Pool } from "pg";

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

export type { CreateNotificationInput };

export interface NotificationRepository {
  createNotification: (
    input: CreateNotificationInput,
  ) => Promise<Notification | undefined>;
  getUnreadNotificationsForUser: (user: NotificationUserScope) => Promise<Notification[]>;
  markNotificationAsReadForUser: (
    notificationId: number,
    user: NotificationUserScope,
  ) => Promise<number>;
  markUnreadNotificationsAsReadForUser: (user: NotificationUserScope) => Promise<number>;
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

const notificationColumns = `
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
`;

export const createNotificationRepository = (
  database: Pool,
): NotificationRepository => {
  const createNotification = async (
    input: CreateNotificationInput,
  ): Promise<Notification | undefined> => {
    const storage = toStorageInput(input);

    const { rows } = await database.query<Notification>(
      `INSERT INTO notifications (
        user_id,
        target_role,
        candidate_id,
        sender_id,
        type,
        title,
        content
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${notificationColumns}`,
      [
        storage.user_id,
        storage.target_role,
        storage.candidate_id,
        storage.sender_id,
        storage.type,
        storage.title,
        storage.content,
      ],
    );

    return rows[0];
  };

  const getUnreadNotificationsForUser = async (
    user: NotificationUserScope,
  ): Promise<Notification[]> => {
    const { rows } = await database.query<Notification>(
      `SELECT ${notificationColumns}
      FROM notifications
      WHERE is_read = 0
        AND (
          user_id = $1
          OR (
            $2 = 'admin'
            AND target_role = 'admin'
          )
        )
      ORDER BY created_at DESC, id DESC`,
      [user.id, user.role],
    );

    return rows;
  };

  const markNotificationAsReadForUser = async (
    notificationId: number,
    user: NotificationUserScope,
  ): Promise<number> => {
    const result = await database.query(
      `UPDATE notifications
      SET is_read = 1
      WHERE id = $1
        AND is_read = 0
        AND (
          user_id = $2
          OR (
            $3 = 'admin'
            AND target_role = 'admin'
          )
        )`,
      [notificationId, user.id, user.role],
    );

    return result.rowCount ?? 0;
  };

  const markUnreadNotificationsAsReadForUser = async (
    user: NotificationUserScope,
  ): Promise<number> => {
    const result = await database.query(
      `UPDATE notifications
      SET is_read = 1
      WHERE is_read = 0
        AND (
          user_id = $1
          OR (
            $2 = 'admin'
            AND target_role = 'admin'
          )
        )`,
      [user.id, user.role],
    );

    return result.rowCount ?? 0;
  };

  return {
    createNotification,
    getUnreadNotificationsForUser,
    markNotificationAsReadForUser,
    markUnreadNotificationsAsReadForUser,
  };
};
