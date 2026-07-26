import type { Response } from "express";

export interface ErrorResponse {
  error: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const sendError = <ResponseBody>(
  response: Response<ResponseBody | ErrorResponse>,
  statusCode: number,
  message: string,
): void => {
  response.status(statusCode).json({ error: message });
};

export const parsePositiveInteger = (value: string): number | null => {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number(value);
};
