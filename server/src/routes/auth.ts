import { Router } from "express";

import { createAuthController } from "../controllers/authController.js";
import db from "../config/db.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createAuthService } from "../services/authService.js";
import {
  createSessionRepository,
  type SessionRepository,
} from "../sessionRepository.js";
import {
  createUserRepository,
  type UserRepository,
} from "../userRepository.js";

interface CreateAuthRouterOptions {
  jwtSecret?: string;
  database?: typeof db;
  userRepository?: UserRepository;
  sessionRepository?: SessionRepository;
}

const defaultJwtSecret = "development-secret";

export const createAuthRouter = ({
  jwtSecret = process.env.JWT_SECRET ?? defaultJwtSecret,
  database = db,
  userRepository = createUserRepository(database),
  sessionRepository = createSessionRepository(database),
}: CreateAuthRouterOptions = {}): Router => {
  const router = Router();

  const authService = createAuthService({ jwtSecret, userRepository, sessionRepository });
  const controller = createAuthController({ authService });
  const { verifyToken } = createAuthMiddleware({ jwtSecret, userRepository });

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);
  router.get("/admins", verifyToken, controller.getAdmins);
  router.get("/me", verifyToken, controller.getMe);

  return router;
};

export default createAuthRouter();
