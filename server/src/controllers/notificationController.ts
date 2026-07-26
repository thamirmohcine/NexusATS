import type { Request, Response } from "express";

import type { Notification } from "../db.js";
import {
  type ErrorResponse,
  parsePositiveInteger,
  sendError,
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
  ) => void;
  markAllAsRead: (
    request: Request<Record<string, never>, ReadAllResponse | ErrorResponse, unknown>,
    response: Response<ReadAllResponse | ErrorResponse>,
  ) => void;
  markOneAsRead: (
    request: Request<{ id: string }, ReadOneResponse | ErrorResponse, unknown>,
    response: Response<ReadOneResponse | ErrorResponse>,
  ) => void;
}

export const createNotificationController = ({
  notificationRepository,
}: CreateNotificationControllerOptions): NotificationController => ({
  getNotifications: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    try {
      response
        .status(200)
        .json(notificationRepository.getUnreadNotificationsForUser(user));
    } catch {
      sendError(response, 500, "Failed to fetch notifications");
    }
  },
  markAllAsRead: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    try {
      notificationRepository.markUnreadNotificationsAsReadForUser(user);
      response.status(200).json({
        message: "Notifications marked as read",
      });
    } catch {
      sendError(response, 500, "Failed to mark notifications as read");
    }
  },
  markOneAsRead: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    const notificationId = parsePositiveInteger(request.params.id);

    if (notificationId === null) {
      sendError(response, 404, "Notification not found");
      return;
    }

    try {
      const readCount = notificationRepository.markNotificationAsReadForUser(
        notificationId,
        user,
      );

      if (readCount === 0) {
        sendError(response, 404, "Notification not found");
        return;
      }

      response.status(200).json({
        message: "Notification marked as read",
      });
    } catch {
      sendError(response, 500, "Failed to mark notification as read");
    }
  },
});
