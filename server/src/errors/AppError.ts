/**
 * Base application error with an HTTP status code.
 * All service-thrown errors should extend this class
 * so the global error middleware can convert them into
 * standard JSON responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

/** 400 – Malformed or semantically invalid input. */
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/** 401 – Missing or invalid authentication. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/** 403 – Authenticated but not permitted. */
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/** 404 – Resource not found. */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/** 409 – Uniqueness / ownership conflict. */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}
