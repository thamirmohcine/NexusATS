import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import type { User } from "../db.js";
import { sendError } from "../http.js";
import type { UserRepository } from "../userRepository.js";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: User;
    }
  }
}

interface CreateAuthMiddlewareOptions {
  jwtSecret: string;
  userRepository: UserRepository;
}

export interface AuthMiddleware {
  verifyToken: RequestHandler;
  checkAdmin: RequestHandler;
}

const getBearerToken = (
  authorizationHeader: string | undefined,
): string | null => {
  if (authorizationHeader === undefined) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.trim().length === 0) {
    return null;
  }

  return token.trim();
};

const getUserIdFromToken = (token: string, jwtSecret: string): number | null => {
  try {
    const decodedToken: string | JwtPayload = jwt.verify(token, jwtSecret);

    if (
      typeof decodedToken === "string" ||
      typeof decodedToken.sub !== "string"
    ) {
      return null;
    }

    if (!/^[1-9]\d*$/.test(decodedToken.sub)) {
      return null;
    }

    return Number(decodedToken.sub);
  } catch {
    return null;
  }
};

export const getAuthenticatedUser = (request: Request): User | null =>
  request.authenticatedUser ?? null;

export const createAuthMiddleware = ({
  jwtSecret,
  userRepository,
}: CreateAuthMiddlewareOptions): AuthMiddleware => {
  const verifyToken = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const token = getBearerToken(request.headers.authorization);

    if (token === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    const userId = getUserIdFromToken(token, jwtSecret);

    if (userId === null) {
      sendError(response, 401, "Invalid authorization token");
      return;
    }

    const user = await userRepository.getUserById(userId);

    if (user === undefined) {
      sendError(response, 401, "Invalid authorization token");
      return;
    }

    request.authenticatedUser = user;
    next();
  };

  const checkAdmin = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    if (user.role !== "admin") {
      sendError(response, 403, "Admin access is required");
      return;
    }

    next();
  };

  return {
    verifyToken,
    checkAdmin,
  };
};
