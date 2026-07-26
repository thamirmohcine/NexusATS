import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

import type { User, UserRole } from "../db.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { type ErrorResponse, isRecord, sendError } from "../http.js";
import type { UserRepository } from "../userRepository.js";

interface AuthUserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthTokenResponse {
  token: string;
  user: AuthUserResponse;
}

interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface CreateAuthControllerOptions {
  jwtSecret: string;
  userRepository: UserRepository;
}

type RegisterValidationResult =
  | { success: true; body: RegisterRequestBody }
  | { success: false; error: string };

type LoginValidationResult =
  | { success: true; body: LoginRequestBody }
  | { success: false; error: string };

export interface AuthController {
  register: (
    request: Request<Record<string, never>, AuthTokenResponse | ErrorResponse, unknown>,
    response: Response<AuthTokenResponse | ErrorResponse>,
  ) => Promise<void>;
  login: (
    request: Request<Record<string, never>, AuthTokenResponse | ErrorResponse, unknown>,
    response: Response<AuthTokenResponse | ErrorResponse>,
  ) => Promise<void>;
  getAdmins: (
    request: Request<Record<string, never>, AuthUserResponse[] | ErrorResponse, unknown>,
    response: Response<AuthUserResponse[] | ErrorResponse>,
  ) => void;
  getMe: (
    request: Request<Record<string, never>, AuthUserResponse | ErrorResponse, unknown>,
    response: Response<AuthUserResponse | ErrorResponse>,
  ) => void;
}

const jwtExpiresIn: SignOptions["expiresIn"] = "7d";
const passwordSaltRounds = 10;

const isUserRole = (value: unknown): value is UserRole =>
  value === "candidate" || value === "admin";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const validateRegisterBody = (body: unknown): RegisterValidationResult => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { success: false, error: "Name is required" };
  }

  if (typeof body.email !== "string" || body.email.trim().length === 0) {
    return { success: false, error: "Email is required" };
  }

  if (typeof body.password !== "string" || body.password.trim().length === 0) {
    return { success: false, error: "Password is required" };
  }

  const role = body.role ?? "candidate";

  if (!isUserRole(role)) {
    return { success: false, error: "Role must be candidate or admin" };
  }

  return {
    success: true,
    body: {
      name: body.name.trim(),
      email: normalizeEmail(body.email),
      password: body.password,
      role,
    },
  };
};

const validateLoginBody = (body: unknown): LoginValidationResult => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (typeof body.email !== "string" || body.email.trim().length === 0) {
    return { success: false, error: "Email is required" };
  }

  if (typeof body.password !== "string" || body.password.trim().length === 0) {
    return { success: false, error: "Password is required" };
  }

  return {
    success: true,
    body: {
      email: normalizeEmail(body.email),
      password: body.password,
    },
  };
};

const toAuthUserResponse = (user: User): AuthUserResponse => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const createToken = (user: User, jwtSecret: string): string =>
  jwt.sign(
    {
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
      subject: String(user.id),
    },
  );

const createAuthResponse = (
  user: User,
  jwtSecret: string,
): AuthTokenResponse => ({
  token: createToken(user, jwtSecret),
  user: toAuthUserResponse(user),
});

const isUniqueConstraintError = (error: unknown): boolean =>
  isRecord(error) &&
  typeof error.code === "string" &&
  error.code === "SQLITE_CONSTRAINT_UNIQUE";

export const createAuthController = ({
  jwtSecret,
  userRepository,
}: CreateAuthControllerOptions): AuthController => ({
  register: async (request, response): Promise<void> => {
    const validation = validateRegisterBody(request.body);

    if (!validation.success) {
      sendError(response, 400, validation.error);
      return;
    }

    if (userRepository.getUserByEmail(validation.body.email) !== undefined) {
      sendError(response, 409, "User already exists");
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(
        validation.body.password,
        passwordSaltRounds,
      );
      const user = userRepository.createUser({
        name: validation.body.name,
        email: validation.body.email,
        password: hashedPassword,
        role: validation.body.role,
      });

      if (user === undefined) {
        sendError(response, 500, "Failed to register user");
        return;
      }

      response.status(201).json(createAuthResponse(user, jwtSecret));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        sendError(response, 409, "User already exists");
        return;
      }

      sendError(response, 500, "Failed to register user");
    }
  },
  login: async (request, response): Promise<void> => {
    const validation = validateLoginBody(request.body);

    if (!validation.success) {
      sendError(response, 400, validation.error);
      return;
    }

    try {
      const user = userRepository.getUserByEmail(validation.body.email);

      if (user === undefined) {
        sendError(response, 401, "Invalid email or password");
        return;
      }

      const isPasswordValid = await bcrypt.compare(
        validation.body.password,
        user.password,
      );

      if (!isPasswordValid) {
        sendError(response, 401, "Invalid email or password");
        return;
      }

      response.status(200).json(createAuthResponse(user, jwtSecret));
    } catch {
      sendError(response, 500, "Failed to login");
    }
  },
  getAdmins: (request, response): void => {
    if (getAuthenticatedUser(request) === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    try {
      response
        .status(200)
        .json(userRepository.getUsersByRole("admin").map(toAuthUserResponse));
    } catch {
      sendError(response, 500, "Failed to fetch admins");
    }
  },
  getMe: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    response.status(200).json(toAuthUserResponse(user));
  },
});
