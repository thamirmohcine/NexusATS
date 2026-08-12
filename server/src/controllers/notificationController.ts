import type { Request, Response } from "express";

import type { Notification } from "../db.js";
import {
  type ErrorResponse,
  parsePositiveInteger,
} from "../http.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import type { NotificationRepository } from "../notificationRepository.js";

interface ReadAllResponse {
  message: string;
}

interface ReadOneResponse {
  message: string;
}

interface CreateNotificationControllerOptions {
  notificationRepository: NotificationRepository;
}

export interface NotificationController {
  getNotifications: (
    request: Request<Record<string, never>, Notification[] | ErrorResponse, unknown>,
    response: Response<Notification[] | ErrorResponse>,
  ) => Promise<void>;
  markAllAsRead: (
    request: Request<Record<string, never>, ReadAllResponse | ErrorResponse, unknown>,
    response: Response<ReadAllResponse | ErrorResponse>,
  ) => Promise<void>;
  markOneAsRead: (
    request: Request<{ id: string }, ReadOneResponse | ErrorResponse, unknown>,
    response: Response<ReadOneResponse | ErrorResponse>,
  ) => Promise<void>;
}

export const createNotificationController = ({
  notificationRepository,
}: CreateNotificationControllerOptions): NotificationController => ({
  getNotifications: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    response
      .status(200)
      .json(await notificationRepository.getUnreadNotificationsForUser(user));
  },
  markAllAsRead: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    await notificationRepository.markUnreadNotificationsAsReadForUser(user);
    response.status(200).json({
      message: "Notifications marked as read",
    });
  },
  markOneAsRead: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    const notificationId = parsePositiveInteger(request.params.id);

    if (notificationId === null) {
      response.status(404).json({ error: "Notification not found" });
      return;
    }

    const readCount = await notificationRepository.markNotificationAsReadForUser(
      notificationId,
      user,
    );

    if (readCount === 0) {
      response.status(404).json({ error: "Notification not found" });
      return;
    }

    response.status(200).json({
      message: "Notification marked as read",
    });
  },
});
