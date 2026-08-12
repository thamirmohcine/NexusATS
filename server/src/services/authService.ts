import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

import { ConflictError, UnauthorizedError } from "../errors/AppError.js";
import { isRecord } from "../http.js";
import type { SessionRepository } from "../sessionRepository.js";
import type { User, UserRole } from "../db.js";
import type { UserRepository } from "../userRepository.js";

// ── Public DTOs ────────────────────────────────────────────────────────

export interface AuthUserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ── Internal types ─────────────────────────────────────────────────────

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

interface CreateAuthServiceOptions {
  jwtSecret: string;
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
}

// ── Constants ──────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY: SignOptions["expiresIn"] = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_LIFETIME_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_BYTES = 64;
const passwordSaltRounds = 10;

// ── Helpers ────────────────────────────────────────────────────────────

const isUserRole = (value: unknown): value is UserRole =>
  value === "candidate" || value === "admin";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toAuthUserResponse = (user: User): AuthUserResponse => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

/** Create a short-lived JWT access token with userId, role, and sessionId. */
const createAccessToken = (
  user: User,
  sessionId: number,
  jwtSecret: string,
): string =>
  jwt.sign({ role: user.role, sessionId }, jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    subject: String(user.id),
  });

/**
 * Generate a cryptographically random refresh token and its SHA-256 hash.
 *
 * SHA-256 is used (not bcrypt) because:
 * - The token itself is a high-entropy (512-bit) random hex string
 * - SHA-256 provides a deterministic hash for O(1) DB lookups
 * - A bcrypt hash would prevent indexed lookups since each hash is different
 */
const createRefreshToken = (): { token: string; hash: string } => {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, hash };
};

const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const getRefreshTokenExpiresAt = (): string =>
  new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS).toISOString();

/** Generate both tokens and persist a new session row. */
const generateTokenPairAndSession = async (
  user: User,
  jwtSecret: string,
  sessionRepository: SessionRepository,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const { token: refreshToken, hash: refreshTokenHash } = createRefreshToken();
  const expiresAt = getRefreshTokenExpiresAt();
  const session = await sessionRepository.createSession({
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    expires_at: expiresAt,
  });

  if (session === undefined) {
    throw new Error("Failed to create session");
  }

  const accessToken = createAccessToken(user, session.id, jwtSecret);

  return { accessToken, refreshToken };
};

const isUniqueConstraintError = (error: unknown): boolean =>
  isRecord(error) &&
  typeof error.code === "string" &&
  (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE");

// ── Validation ─────────────────────────────────────────────────────────

export interface RegisterValidationResult {
  success: true;
  body: RegisterInput;
}

export type RegisterValidation =
  | RegisterValidationResult
  | { success: false; error: string };

export const validateRegisterBody = (body: unknown): RegisterValidation => {
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

export interface LoginValidationResult {
  success: true;
  body: LoginInput;
}

export type LoginValidation =
  | LoginValidationResult
  | { success: false; error: string };

export const validateLoginBody = (body: unknown): LoginValidation => {
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

export interface RefreshValidationResult {
  success: true;
  refreshToken: string;
}

export type RefreshValidation =
  | RefreshValidationResult
  | { success: false; error: string };

export const validateRefreshBody = (body: unknown): RefreshValidation => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (typeof body.refreshToken !== "string" || body.refreshToken.trim().length === 0) {
    return { success: false, error: "Refresh token is required" };
  }

  return { success: true, refreshToken: body.refreshToken.trim() };
};

// ── Service Factory ────────────────────────────────────────────────────

export interface AuthService {
  register(input: RegisterInput): Promise<AuthTokenResponse>;
  login(input: LoginInput): Promise<AuthTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse>;
  logout(refreshToken: string): Promise<void>;
  getCurrentUser(user: User): AuthUserResponse;
  getAdmins(): Promise<AuthUserResponse[]>;
}

export const createAuthService = ({
  jwtSecret,
  userRepository,
  sessionRepository,
}: CreateAuthServiceOptions): AuthService => ({
  register: async (input: RegisterInput): Promise<AuthTokenResponse> => {
    const existingUser = await userRepository.getUserByEmail(input.email);

    if (existingUser !== undefined) {
      throw new ConflictError("User already exists");
    }

    try {
      const hashedPassword = await bcrypt.hash(input.password, passwordSaltRounds);
      const user = await userRepository.createUser({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: input.role,
      });

      if (user === undefined) {
        throw new Error("Failed to create user");
      }

      const { accessToken, refreshToken } = await generateTokenPairAndSession(
        user,
        jwtSecret,
        sessionRepository,
      );

      return {
        accessToken,
        refreshToken,
        user: toAuthUserResponse(user),
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("User already exists");
      }

      throw error;
    }
  },

  login: async (input: LoginInput): Promise<AuthTokenResponse> => {
    const user = await userRepository.getUserByEmail(input.email);

    if (user === undefined) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const { accessToken, refreshToken } = await generateTokenPairAndSession(
      user,
      jwtSecret,
      sessionRepository,
    );

    return {
      accessToken,
      refreshToken,
      user: toAuthUserResponse(user),
    };
  },

  refreshAccessToken: async (
    refreshToken: string,
  ): Promise<RefreshTokenResponse> => {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await sessionRepository.findByRefreshTokenHash(tokenHash);

    if (session === undefined) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await userRepository.getUserById(session.user_id);

    if (user === undefined) {
      throw new UnauthorizedError("User not found");
    }

    // Token rotation: revoke the old session and issue a new token pair
    await sessionRepository.revokeSession(session.id);

    const { accessToken, refreshToken: newRefreshToken } =
      await generateTokenPairAndSession(user, jwtSecret, sessionRepository);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  logout: async (refreshToken: string): Promise<void> => {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await sessionRepository.findByRefreshTokenHash(tokenHash);

    if (session === undefined) {
      // Silently succeed — token already invalid/expired
      return;
    }

    await sessionRepository.revokeSession(session.id);
  },

  getCurrentUser: (user: User): AuthUserResponse => toAuthUserResponse(user),

  getAdmins: async (): Promise<AuthUserResponse[]> =>
    (await userRepository.getUsersByRole("admin")).map(toAuthUserResponse),
});
