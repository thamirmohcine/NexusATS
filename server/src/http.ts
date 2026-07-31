import type { Response } from "express";

export interface ErrorResponse {
  error: string;
}

/** Type guard — is this a non-null, non-array object? */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Send a standard JSON error response and terminate the request. */
export const sendError = <ResponseBody>(
  response: Response<ResponseBody | ErrorResponse>,
  statusCode: number,
  message: string,
): void => {
  response.status(statusCode).json({ error: message });
};

/** Send a success JSON response. */
export const sendSuccess = <T>(
  response: Response<T | ErrorResponse>,
  data: T,
  statusCode = 200,
): void => {
  response.status(statusCode).json(data);
};

/** Parse a URL param string into a positive integer, or null if invalid. */
export const parsePositiveInteger = (value: string): number | null => {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number(value);
};
