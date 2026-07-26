import { Router } from "express";

import { createAuthController } from "../controllers/authController.js";
import db from "../config/db.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import {
  createUserRepository,
  type UserRepository,
} from "../userRepository.js";

interface CreateAuthRouterOptions {
  jwtSecret?: string;
  userRepository?: UserRepository;
}

const defaultJwtSecret = "development-secret";

export const createAuthRouter = ({
  jwtSecret = process.env.JWT_SECRET ?? defaultJwtSecret,
  userRepository = createUserRepository(db),
}: CreateAuthRouterOptions = {}): Router => {
  const router = Router();
  const controller = createAuthController({
    jwtSecret,
    userRepository,
  });
  const { verifyToken } = createAuthMiddleware({
    jwtSecret,
    userRepository,
  });

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/admins", verifyToken, controller.getAdmins);
  router.get("/me", verifyToken, controller.getMe);

  return router;
};

export default createAuthRouter();
