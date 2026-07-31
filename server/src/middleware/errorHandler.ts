import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import type { ErrorResponse } from "../http.js";
import type { Logger } from "../services/logger.js";

/**
 * Global Express error handler.
 *
 * Place this **after** all routes so that errors thrown (or passed via `next(err)`)
 * in controllers, services, and middleware are caught here.
 *
 * - AppError subclasses → their `statusCode` + message
 * - Everything else      → 500 Internal Server Error
 */
export const createGlobalErrorHandler = (logger: Logger) => {
  return (
    error: Error,
    _request: Request,
    response: Response<ErrorResponse>,
    _next: NextFunction,
  ): void => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(error.message, {
          errorName: error.name,
          statusCode: error.statusCode,
          stack: error.stack,
        });
      }

      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    logger.error("Unhandled internal server error", {
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    });

    response.status(500).json({ error: "Internal server error" });
  };
};
