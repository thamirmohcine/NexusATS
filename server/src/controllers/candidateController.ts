import type { NextFunction, Request, Response } from "express";

import type { CandidateResponse } from "../candidateResponse.js";
import type { ErrorResponse } from "../http.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { buildPdfUrl } from "../middleware/upload.js";
import type { CandidateService } from "../services/candidateService.js";

// Wraps an async handler so rejected promises forward to next(error).
const asyncHandler =
  <P, ResBody>(
    fn: (
      req: Request<P, ResBody | ErrorResponse, unknown>,
      res: Response<ResBody | ErrorResponse>,
      next: NextFunction,
    ) => void | Promise<void>,
  ) =>
  (
    req: Request<P, ResBody | ErrorResponse, unknown>,
    res: Response<ResBody | ErrorResponse>,
    next: NextFunction,
  ): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const requireAuth = <ResBody>(
  request: Request,
  response: Response<ResBody | ErrorResponse>,
): boolean => {
  const user = getAuthenticatedUser(request);

  if (user === null) {
    response.status(401).json({ error: "Authorization token is required" });
    return false;
  }

  return true;
};

interface CreateCandidateControllerOptions {
  candidateService: CandidateService;
}

export interface CandidateController {
  getCandidates: (
    request: Request<Record<string, never>, CandidateResponse[] | ErrorResponse, unknown>,
    response: Response<CandidateResponse[] | ErrorResponse>,
    next: NextFunction,
  ) => void;
  deleteCandidate: (
    request: Request<{ id: string }, { message: string } | ErrorResponse, unknown>,
    response: Response<{ message: string } | ErrorResponse>,
    next: NextFunction,
  ) => void;
  createCandidate: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
    next: NextFunction,
  ) => void;
  analyzeResume: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
    next: NextFunction,
  ) => void;
  uploadPdf: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
    next: NextFunction,
  ) => void;
}

export const createCandidateController = ({
  candidateService,
}: CreateCandidateControllerOptions): CandidateController => ({
  getCandidates: asyncHandler(async (_request, response, next) => {
    const user = getAuthenticatedUser(_request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    const candidates = await candidateService.getCandidates(user);

    response.status(200).json(candidates);
  }),

  deleteCandidate: asyncHandler(async (request, response) => {
    if (!requireAuth(request, response)) return;

    await candidateService.deleteCandidate(
      getAuthenticatedUser(request)!,
      request.params.id,
    );

    response.status(200).json({ message: "Candidate deleted successfully" });
  }),

  createCandidate: asyncHandler(async (request, response) => {
    if (!requireAuth(request, response)) return;

    const candidate = await candidateService.createCandidate(
      getAuthenticatedUser(request)!,
      request.body,
    );

    response.status(201).json(candidate);
  }),

  analyzeResume: asyncHandler(async (request, response) => {
    if (!requireAuth(request, response)) return;

    const candidate = await candidateService.analyzeResume(
      getAuthenticatedUser(request)!,
      request.body,
    );

    response.status(201).json(candidate);
  }),

  uploadPdf: asyncHandler(async (request, response) => {
    if (!requireAuth(request, response)) return;

    const pdfUrl = request.file
      ? buildPdfUrl(request, request.file.filename)
      : undefined;
    const candidate = await candidateService.uploadPdf(
      getAuthenticatedUser(request)!,
      request.file,
      pdfUrl,
    );

    response.status(201).json(candidate);
  }),
});
