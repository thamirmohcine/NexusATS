import type { Request, Response } from "express";
import { readFile, unlink } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";

import {
  toCandidateResponse,
  type CandidateResponse,
} from "../candidateResponse.js";
import type { CandidateRepository } from "../candidateRepository.js";
import type { CreateCandidateInput, User } from "../db.js";
import {
  type ErrorResponse,
  isRecord,
  parsePositiveInteger,
  sendError,
} from "../http.js";
import { createLocalizedSummary } from "../localizedSummary.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { buildPdfUrl } from "../middleware/upload.js";
import type { NotificationRepository } from "../notificationRepository.js";
import type { ResumeAnalysis } from "../services/ai.js";

interface DeleteCandidateResponse {
  message: string;
}

interface CreateCandidateRequestBody {
  name: string;
  email: string | null;
  skills: string[];
  summary: string | null;
  score: number;
}

export type AnalyzeResumeService = (
  resumeText: string,
) => Promise<ResumeAnalysis>;

export type ExtractPdfTextService = (pdfBuffer: Buffer) => Promise<string>;

interface CreateCandidateControllerOptions {
  candidateRepository: CandidateRepository;
  analyzeResumeService: AnalyzeResumeService;
  extractPdfTextService: ExtractPdfTextService;
  notificationRepository: NotificationRepository;
  uploadsDirectory: string;
}

type ValidationResult =
  | { success: true; candidate: CreateCandidateRequestBody }
  | { success: false; error: string };

type ResumeTextValidationResult =
  | { success: true; resumeText: string }
  | { success: false; error: string };

export interface CandidateController {
  getCandidates: (
    request: Request<Record<string, never>, CandidateResponse[] | ErrorResponse, unknown>,
    response: Response<CandidateResponse[] | ErrorResponse>,
  ) => void;
  deleteCandidate: (
    request: Request<{ id: string }, DeleteCandidateResponse | ErrorResponse, unknown>,
    response: Response<DeleteCandidateResponse | ErrorResponse>,
  ) => Promise<void>;
  createCandidate: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
  ) => void;
  analyzeResume: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
  ) => Promise<void>;
  uploadPdf: (
    request: Request<Record<string, never>, CandidateResponse | ErrorResponse, unknown>,
    response: Response<CandidateResponse | ErrorResponse>,
  ) => Promise<void>;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const nullableText = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const validateCandidateBody = (body: unknown): ValidationResult => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { success: false, error: "Name is required" };
  }

  if (!isStringArray(body.skills)) {
    return { success: false, error: "Skills must be an array of strings" };
  }

  if (
    typeof body.score !== "number" ||
    !Number.isInteger(body.score) ||
    body.score < 1 ||
    body.score > 100
  ) {
    return { success: false, error: "Score must be an integer from 1 to 100" };
  }

  try {
    return {
      success: true,
      candidate: {
        name: body.name.trim(),
        email: nullableText(body.email, "Email"),
        skills: body.skills.map((skill) => skill.trim()),
        summary: nullableText(body.summary, "Summary"),
        score: body.score,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid request body",
    };
  }
};

const validateResumeTextBody = (body: unknown): ResumeTextValidationResult => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (
    typeof body.resumeText !== "string" ||
    body.resumeText.trim().length === 0
  ) {
    return { success: false, error: "Resume text is required" };
  }

  return {
    success: true,
    resumeText: body.resumeText.trim(),
  };
};

const requireCandidateUser = <ResponseBody>(
  user: User,
  response: Response<ResponseBody | ErrorResponse>,
): boolean => {
  if (user.role !== "candidate") {
    sendError(response, 403, "Only candidates can submit resumes");
    return false;
  }

  return true;
};

const candidateOwnershipConflictMessage =
  "Candidate profile already belongs to another account";

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  isRecord(error) && typeof error.code === "string";

const resolveUploadedPdfPath = (
  pdfUrl: string | null,
  uploadsDirectory: string,
): string | null => {
  if (pdfUrl === null) {
    return null;
  }

  try {
    const parsedUrl = new URL(pdfUrl);

    if (!parsedUrl.pathname.startsWith("/uploads/")) {
      return null;
    }

    const fileName = basename(parsedUrl.pathname);

    if (fileName.length === 0) {
      return null;
    }

    const uploadsRoot = resolve(uploadsDirectory);
    const uploadedFilePath = resolve(uploadsRoot, fileName);
    const relativeFilePath = relative(uploadsRoot, uploadedFilePath);

    if (relativeFilePath.startsWith("..") || isAbsolute(relativeFilePath)) {
      return null;
    }

    return uploadedFilePath;
  } catch {
    return null;
  }
};

const deleteUploadedPdfFile = async (
  pdfUrl: string | null,
  uploadsDirectory: string,
): Promise<void> => {
  const pdfFilePath = resolveUploadedPdfPath(pdfUrl, uploadsDirectory);

  if (pdfFilePath === null) {
    return;
  }

  try {
    await unlink(pdfFilePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
};

const saveCandidate = (
  candidateRepository: CandidateRepository,
  createCandidateInput: CreateCandidateInput,
): CandidateResponse | undefined => {
  const candidate = candidateRepository.upsertCandidate(createCandidateInput);

  return candidate === undefined ? undefined : toCandidateResponse(candidate);
};

const notifyAdminsOfCandidateApplication = (
  notificationRepository: NotificationRepository,
  candidate: CandidateResponse,
  senderId: number,
): void => {
  notificationRepository.createNotification({
    user_id: null,
    target_role: "admin",
    candidate_id: candidate.id,
    sender_id: senderId,
    type: "candidate_application",
    title: "New candidate application",
    content: `${candidate.name} submitted a resume.`,
  });
};

const saveAnalysis = async (
  candidateRepository: CandidateRepository,
  analyzeResumeService: AnalyzeResumeService,
  notificationRepository: NotificationRepository,
  user: User,
  resumeText: string,
  pdfUrl?: string | null,
): Promise<CandidateResponse | undefined> => {
  const analysis = await analyzeResumeService(resumeText);

  const candidate = saveCandidate(candidateRepository, {
    user_id: user.id,
    name: analysis.candidateName,
    email: analysis.email,
    phone: analysis.phone,
    linkedin: analysis.linkedin,
    github: analysis.github,
    pdf_url: pdfUrl ?? null,
    skills: JSON.stringify(analysis.skills),
    experience: JSON.stringify(analysis.experience),
    projects: JSON.stringify(analysis.projects),
    summary: JSON.stringify(analysis.summary),
    score: analysis.score,
  });

  if (candidate !== undefined) {
    notifyAdminsOfCandidateApplication(
      notificationRepository,
      candidate,
      user.id,
    );
  }

  return candidate;
};

export const createCandidateController = ({
  candidateRepository,
  analyzeResumeService,
  extractPdfTextService,
  notificationRepository,
  uploadsDirectory,
}: CreateCandidateControllerOptions): CandidateController => ({
  getCandidates: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    try {
      const candidates =
        user.role === "admin"
          ? candidateRepository.getCandidates()
          : candidateRepository.getCandidatesByUserId(user.id);

      response.status(200).json(candidates.map(toCandidateResponse));
    } catch {
      sendError(response, 500, "Failed to fetch candidates");
    }
  },
  deleteCandidate: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    const candidateId = parsePositiveInteger(request.params.id);

    if (candidateId === null) {
      sendError(response, 404, "Candidate not found");
      return;
    }

    try {
      const candidateToDelete = candidateRepository.getCandidateById(candidateId);

      if (candidateToDelete === undefined) {
        sendError(response, 404, "Candidate not found");
        return;
      }

      if (user.role !== "admin" && candidateToDelete.user_id !== user.id) {
        sendError(response, 404, "Candidate not found");
        return;
      }

      const deletedCandidate =
        candidateRepository.deleteCandidateWithRelatedRecords(candidateId);

      if (deletedCandidate === undefined) {
        sendError(response, 404, "Candidate not found");
        return;
      }

      await deleteUploadedPdfFile(deletedCandidate.pdf_url, uploadsDirectory);

      response.status(200).json({
        message: "Candidate deleted successfully",
      });
    } catch {
      sendError(response, 500, "Failed to delete candidate");
    }
  },
  createCandidate: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    if (!requireCandidateUser(user, response)) {
      return;
    }

    const validation = validateCandidateBody(request.body);

    if (!validation.success) {
      sendError(response, 400, validation.error);
      return;
    }

    try {
      const candidate = saveCandidate(candidateRepository, {
        user_id: user.id,
        name: validation.candidate.name,
        email: validation.candidate.email,
        skills: JSON.stringify(validation.candidate.skills),
        summary:
          validation.candidate.summary === null
            ? null
            : JSON.stringify(createLocalizedSummary(validation.candidate.summary)),
        score: validation.candidate.score,
      });

      if (candidate === undefined) {
        sendError(response, 409, candidateOwnershipConflictMessage);
        return;
      }

      response.status(201).json(candidate);
    } catch {
      sendError(response, 500, "Failed to create candidate");
    }
  },
  analyzeResume: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    if (!requireCandidateUser(user, response)) {
      return;
    }

    const validation = validateResumeTextBody(request.body);

    if (!validation.success) {
      sendError(response, 400, validation.error);
      return;
    }

    try {
      const candidate = await saveAnalysis(
        candidateRepository,
        analyzeResumeService,
        notificationRepository,
        user,
        validation.resumeText,
      );

      if (candidate === undefined) {
        sendError(response, 409, candidateOwnershipConflictMessage);
        return;
      }

      response.status(201).json(candidate);
    } catch {
      sendError(response, 500, "Failed to analyze resume");
    }
  },
  uploadPdf: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    if (!requireCandidateUser(user, response)) {
      return;
    }

    if (request.file === undefined) {
      sendError(response, 400, "PDF file is required");
      return;
    }

    try {
      const resumeText = await extractPdfTextService(
        await readFile(request.file.path),
      );

      if (resumeText.length === 0) {
        sendError(response, 400, "PDF did not contain extractable text");
        return;
      }

      const candidate = await saveAnalysis(
        candidateRepository,
        analyzeResumeService,
        notificationRepository,
        user,
        resumeText,
        buildPdfUrl(request, request.file.filename),
      );

      if (candidate === undefined) {
        sendError(response, 409, candidateOwnershipConflictMessage);
        return;
      }

      response.status(201).json(candidate);
    } catch {
      sendError(response, 500, "Failed to process PDF resume");
    }
  },
});
