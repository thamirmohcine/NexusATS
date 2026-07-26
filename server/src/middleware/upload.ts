import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sendError } from "../http.js";

export const defaultUploadsDirectory = resolve(
  fileURLToPath(new URL("../../uploads", import.meta.url)),
);

const allowedPdfExtension = ".pdf";

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

export const buildPdfUrl = (request: Request, fileName: string): string =>
  `${request.protocol}://${request.get("host") ?? "localhost:5000"}/uploads/${fileName}`;

export const createUploadSinglePdf = (
  uploadsDirectory: string,
): RequestHandler => {
  mkdirSync(uploadsDirectory, { recursive: true });

  const uploadSinglePdf = multer({
    storage: multer.diskStorage({
      destination: (
        _request: Request,
        _file: Express.Multer.File,
        callback,
      ): void => {
        callback(null, uploadsDirectory);
      },
      filename: (
        _request: Request,
        file: Express.Multer.File,
        callback,
      ): void => {
        callback(null, `${Date.now()}-${sanitizeFileName(file.originalname)}`);
      },
    }),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (
      _request: Request,
      file: Express.Multer.File,
      callback,
    ): void => {
      if (extname(file.originalname).toLowerCase() !== allowedPdfExtension) {
        callback(new Error("Only PDF files are allowed"));
        return;
      }

      callback(null, true);
    },
  }).single("file");

  return (request: Request, response: Response, next: NextFunction): void => {
    uploadSinglePdf(request, response, (error: unknown): void => {
      if (error instanceof Error) {
        sendError(response, 400, error.message);
        return;
      }

      if (error !== undefined && error !== null) {
        sendError(response, 400, "Failed to upload PDF");
        return;
      }

      next();
    });
  };
};
