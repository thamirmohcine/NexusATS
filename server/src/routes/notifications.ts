import { Router } from "express";

import db from "../config/db.js";
import { createNotificationController } from "../controllers/notificationController.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import {
  createNotificationRepository,
  type NotificationRepository,
} from "../notificationRepository.js";
import {
  createUserRepository,
  type UserRepository,
} from "../userRepository.js";

interface CreateNotificationsRouterOptions {
  jwtSecret?: string;
  database?: typeof db;
  userRepository?: UserRepository;
  notificationRepository?: NotificationRepository;
}

const defaultJwtSecret = "development-secret";

export const createNotificationsRouter = ({
  jwtSecret = process.env.JWT_SECRET ?? defaultJwtSecret,
  database = db,
  userRepository = createUserRepository(database),
  notificationRepository = createNotificationRepository(database),
}: CreateNotificationsRouterOptions = {}): Router => {
  const router = Router();
  const controller = createNotificationController({
    notificationRepository,
  });
  const { verifyToken } = createAuthMiddleware({
    jwtSecret,
    userRepository,
  });

  router.get("/", verifyToken, controller.getNotifications);
  router.patch("/read-all", verifyToken, controller.markAllAsRead);
  router.patch("/:id/read", verifyToken, controller.markOneAsRead);

  return router;
};

export default createNotificationsRouter();
