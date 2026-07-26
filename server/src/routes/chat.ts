import { Router } from "express";

import {
  type CandidateRepository,
  createCandidateRepository,
} from "../candidateRepository.js";
import { createChatController } from "../controllers/chatController.js";
import db from "../config/db.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import {
  createMessageRepository,
  type MessageRepository,
} from "../messageRepository.js";
import {
  createNotificationRepository,
  type NotificationRepository,
} from "../notificationRepository.js";
import {
  createUserRepository,
  type UserRepository,
} from "../userRepository.js";

interface CreateChatRouterOptions {
  jwtSecret?: string;
  database?: typeof db;
  userRepository?: UserRepository;
  candidateRepository?: CandidateRepository;
  messageRepository?: MessageRepository;
  notificationRepository?: NotificationRepository;
}

const defaultJwtSecret = "development-secret";

export const createChatRouter = ({
  jwtSecret = process.env.JWT_SECRET ?? defaultJwtSecret,
  database = db,
  userRepository = createUserRepository(database),
  candidateRepository = createCandidateRepository(database),
  messageRepository = createMessageRepository(database),
  notificationRepository = createNotificationRepository(database),
}: CreateChatRouterOptions = {}): Router => {
  const router = Router();
  const controller = createChatController({
    userRepository,
    candidateRepository,
    messageRepository,
    notificationRepository,
  });
  const { verifyToken } = createAuthMiddleware({
    jwtSecret,
    userRepository,
  });

  router.post("/send", verifyToken, controller.sendMessage);
  router.get("/:candidate_id", verifyToken, controller.getMessages);

  return router;
};

export default createChatRouter();
