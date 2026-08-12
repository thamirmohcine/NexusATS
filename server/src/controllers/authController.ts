import type { Request, Response } from "express";

import type {
  AuthUserResponse,
  AuthTokenResponse,
  RefreshTokenResponse,
} from "../services/authService.js";
import { type ErrorResponse } from "../http.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import {
  type AuthService,
  validateRegisterBody,
  validateLoginBody,
  validateRefreshBody,
} from "../services/authService.js";

interface CreateAuthControllerOptions {
  authService: AuthService;
}

interface LogoutResponse {
  message: string;
}

export interface AuthController {
  register: (
    request: Request<Record<string, never>, AuthTokenResponse | ErrorResponse, unknown>,
    response: Response<AuthTokenResponse | ErrorResponse>,
  ) => Promise<void>;
  login: (
    request: Request<Record<string, never>, AuthTokenResponse | ErrorResponse, unknown>,
    response: Response<AuthTokenResponse | ErrorResponse>,
  ) => Promise<void>;
  refresh: (
    request: Request<Record<string, never>, RefreshTokenResponse | ErrorResponse, unknown>,
    response: Response<RefreshTokenResponse | ErrorResponse>,
  ) => Promise<void>;
  logout: (
    request: Request<Record<string, never>, LogoutResponse | ErrorResponse, unknown>,
    response: Response<LogoutResponse | ErrorResponse>,
  ) => Promise<void>;
  getAdmins: (
    request: Request<Record<string, never>, AuthUserResponse[] | ErrorResponse, unknown>,
    response: Response<AuthUserResponse[] | ErrorResponse>,
  ) => Promise<void>;
  getMe: (
    request: Request<Record<string, never>, AuthUserResponse | ErrorResponse, unknown>,
    response: Response<AuthUserResponse | ErrorResponse>,
  ) => void;
}

export const createAuthController = ({
  authService,
}: CreateAuthControllerOptions): AuthController => ({
  register: async (request, response): Promise<void> => {
    const validation = validateRegisterBody(request.body);

    if (!validation.success) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const result = await authService.register(validation.body);

    response.status(201).json(result);
  },

  login: async (request, response): Promise<void> => {
    const validation = validateLoginBody(request.body);

    if (!validation.success) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const result = await authService.login(validation.body);

    response.status(200).json(result);
  },

  refresh: async (request, response): Promise<void> => {
    const validation = validateRefreshBody(request.body);

    if (!validation.success) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const result = await authService.refreshAccessToken(validation.refreshToken);

    response.status(200).json(result);
  },

  logout: async (request, response): Promise<void> => {
    const validation = validateRefreshBody(request.body);

    if (!validation.success) {
      response.status(400).json({ error: validation.error });
      return;
    }

    await authService.logout(validation.refreshToken);

    response.status(200).json({ message: "Logged out successfully" });
  },

  getAdmins: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    response.status(200).json(await authService.getAdmins());
  },

  getMe: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    response.status(200).json(authService.getCurrentUser(user));
  },
});
