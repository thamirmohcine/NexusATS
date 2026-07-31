/**
 * Request Logging Middleware
 *
 * Logs structured HTTP request data for every incoming request:
 *   - HTTP method
 *   - URL path
 *   - Response status code
 *   - Duration in milliseconds
 *   - Authenticated user ID (when available)
 *
 * Place this early in the middleware chain (before routes) so it
 * captures timing for every request including slow operations.
 */

import type { Request, Response, NextFunction } from "express";
import type { Logger } from "../services/logger.js";

export const createRequestLogger = (logger: Logger) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    // Listen for the response finish event to capture status code and timing
    response.on("finish", () => {
      const durationNanoseconds = Number(process.hrtime.bigint() - startTime);
      const durationMilliseconds = Math.round(durationNanoseconds / 1_000_000);

      const meta: Record<string, unknown> = {
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        duration: durationMilliseconds,
      };

      // Attach user_id if the request has been authenticated
      const authUser = (request as unknown as Record<string, unknown>).authenticatedUser;
      if (authUser !== undefined && authUser !== null) {
        const userRecord = authUser as Record<string, unknown>;
        if (typeof userRecord.id === "number") {
          meta.userId = userRecord.id;
        }
      }

      const level =
        response.statusCode >= 500
          ? "error"
          : response.statusCode >= 400
            ? "warn"
            : "info";

      logger[level]("HTTP Request", meta);
    });

    next();
  };
};
