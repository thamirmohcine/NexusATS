import { readFile, unlink } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";

import {
  toCandidateResponse,
  type CandidateResponse,
} from "../candidateResponse.js";
import type { CandidateRepository } from "../candidateRepository.js";
import type {
  Candidate,
  CandidateWithAnalysis,
  User,
} from "../db.js";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "../errors/AppError.js";
import { isRecord, parsePositiveInteger } from "../http.js";
import { createLocalizedSummary } from "../localizedSummary.js";
import type { NotificationService } from "./notificationService.js";
import type { ResumeAnalysis } from "./ai.js";

// ── Public types ───────────────────────────────────────────────────────

export type AnalyzeResumeService = (
  resumeText: string,
) => Promise<ResumeAnalysis>;

export type ExtractPdfTextService = (pdfBuffer: Buffer) => Promise<string>;

// ── Internal types ─────────────────────────────────────────────────────

interface CreateCandidateControllerOptions {
  candidateRepository: CandidateRepository;
  analyzeResumeService: AnalyzeResumeService;
  extractPdfTextService: ExtractPdfTextService;
  notificationService: NotificationService;
  uploadsDirectory: string;
}

type ValidationResult =
  | { success: true; candidate: CreateCandidateRequestBody }
  | { success: false; error: string };

interface CreateCandidateRequestBody {
  name: string;
  email: string | null;
  skills: string[];
  summary: string | null;
  score: number;
}

// ── Validation ─────────────────────────────────────────────────────────

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const nullableText = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null) return null;

  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const validateCandidateBody = (body: unknown): ValidationResult => {
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

export interface ResumeTextValidationResult {
  success: true;
  resumeText: string;
}

export type ResumeTextValidation =
  | ResumeTextValidationResult
  | { success: false; error: string };

export const validateResumeTextBody = (body: unknown): ResumeTextValidation => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (typeof body.resumeText !== "string" || body.resumeText.trim().length === 0) {
    return { success: false, error: "Resume text is required" };
  }

  return { success: true, resumeText: body.resumeText.trim() };
};

// ── Helpers ────────────────────────────────────────────────────────────

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  isRecord(error) && typeof error.code === "string";

const resolveUploadedPdfPath = (
  pdfUrl: string | null,
  uploadsDirectory: string,
): string | null => {
  if (pdfUrl === null) return null;

  try {
    const parsedUrl = new URL(pdfUrl);

    if (!parsedUrl.pathname.startsWith("/uploads/")) return null;

    const fileName = basename(parsedUrl.pathname);
    if (fileName.length === 0) return null;

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

  if (pdfFilePath === null) return;

  try {
    await unlink(pdfFilePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;

    throw error;
  }
};

/**
 * Build the full CandidateWithAnalysis from a basic Candidate record,
 * fetching the latest resume + analysis data. If none exists, returns
 * the candidate with null analysis fields.
 */
const buildCandidateWithAnalysis = (
  candidate: Candidate,
  repository: CandidateRepository,
): CandidateWithAnalysis =>
  repository.getCandidateById(candidate.id) ?? {
    ...candidate,
    pdf_url: null,
    skills: null,
    experience: null,
    projects: null,
    summary: null,
    score: null,
  };

// ── Service Factory ────────────────────────────────────────────────────

export interface CandidateService {
  getCandidates(user: User): CandidateResponse[];
  deleteCandidate(user: User, candidateId: string): Promise<void>;
  createCandidate(user: User, body: unknown): CandidateResponse;
  analyzeResume(
    user: User,
    body: unknown,
    pdfUrl?: string | null,
  ): Promise<CandidateResponse>;
  uploadPdf(
    user: User,
    file: Express.Multer.File | undefined,
    pdfUrl?: string | null,
  ): Promise<CandidateResponse>;
}

export const createCandidateService = ({
  candidateRepository,
  analyzeResumeService,
  extractPdfTextService,
  notificationService,
  uploadsDirectory,
}: CreateCandidateControllerOptions): CandidateService => {
  /**
   * Core flow: create the candidate (find or create), create a resume record,
   * run AI analysis, create a resume_analysis record, and return the response.
   */
  const saveAnalysis = async (
    user: User,
    resumeText: string,
    pdfUrl?: string | null,
  ): Promise<CandidateResponse> => {
    const analysis = await analyzeResumeService(resumeText);

    // Step 1: Find or create candidate
    const candidate = candidateRepository.findOrCreateCandidate({
      user_id: user.id,
      name: analysis.candidateName,
      email: analysis.email,
      phone: analysis.phone,
      linkedin: analysis.linkedin,
      github: analysis.github,
    });

    // Check ownership: if the candidate already existed but belongs to
    // a different user, reject
    if (
      candidate.user_id !== null &&
      candidate.user_id !== user.id
    ) {
      throw new ConflictError(
        "Candidate profile already belongs to another account",
      );
    }

    // If the candidate was unclaimed (legacy/admin-created), claim it for this user
    if (candidate.user_id === null && user.role === "candidate") {
      candidateRepository.updateCandidateUser(candidate.id, user.id);
    }

    // Step 2: Create a resume record
    const resume = candidateRepository.insertResume({
      candidate_id: candidate.id,
      pdf_url: pdfUrl ?? null,
    });

    if (resume === undefined) {
      throw new Error("Failed to create resume record");
    }

    // Step 3: Create a resume_analysis record
    const resumeAnalysis = candidateRepository.insertResumeAnalysis({
      resume_id: resume.id,
      skills: JSON.stringify(analysis.skills),
      experience: JSON.stringify(analysis.experience),
      projects: JSON.stringify(analysis.projects),
      summary: JSON.stringify(analysis.summary),
      score: analysis.score,
    });

    if (resumeAnalysis === undefined) {
      throw new Error("Failed to create resume analysis");
    }

    // Step 4: Return the full candidate with the latest analysis
    const fullCandidate = buildCandidateWithAnalysis(candidate, candidateRepository);

    // Notify admins
    notificationService.notifyCandidateApplication(
      toCandidateResponse(fullCandidate),
      user.id,
    );

    return toCandidateResponse(fullCandidate);
  };

  return {
    getCandidates: (user: User): CandidateResponse[] => {
      const candidates =
        user.role === "admin"
          ? candidateRepository.getCandidates()
          : candidateRepository.getCandidatesByUserId(user.id);

      return candidates.map(toCandidateResponse);
    },

    deleteCandidate: async (user: User, candidateId: string): Promise<void> => {
      const id = parsePositiveInteger(candidateId);

      if (id === null) {
        throw new NotFoundError("Candidate not found");
      }

      const candidateToDelete = candidateRepository.getCandidateById(id);

      if (candidateToDelete === undefined) {
        throw new NotFoundError("Candidate not found");
      }

      if (user.role !== "admin" && candidateToDelete.user_id !== user.id) {
        throw new NotFoundError("Candidate not found");
      }

      const deletedCandidate =
        candidateRepository.deleteCandidateWithRelatedRecords(id);

      if (deletedCandidate === undefined) {
        throw new NotFoundError("Candidate not found");
      }

      await deleteUploadedPdfFile(deletedCandidate.pdf_url, uploadsDirectory);
    },

    createCandidate: (user: User, body: unknown): CandidateResponse => {
      if (user.role !== "candidate") {
        throw new ForbiddenError("Only candidates can submit resumes");
      }

      const validation = validateCandidateBody(body);

      if (!validation.success) {
        throw new Error(validation.error);
      }

      // Step 1: Find or create candidate
      const candidate = candidateRepository.findOrCreateCandidate({
        user_id: user.id,
        name: validation.candidate.name,
        email: validation.candidate.email,
      });

      if (candidate.user_id !== null && candidate.user_id !== user.id) {
        throw new ConflictError(
          "Candidate profile already belongs to another account",
        );
      }

      // If the candidate was unclaimed, claim it for this user
      if (candidate.user_id === null && user.role === "candidate") {
        candidateRepository.updateCandidateUser(candidate.id, user.id);
      }

      // Step 2: Create a resume record (no PDF)
      const resume = candidateRepository.insertResume({
        candidate_id: candidate.id,
        pdf_url: null,
      });

      if (resume === undefined) {
        throw new Error("Failed to create resume record");
      }

      // Step 3: Create a resume_analysis record with the provided data
      const summary =
        validation.candidate.summary === null
          ? null
          : JSON.stringify(
              createLocalizedSummary(validation.candidate.summary),
            );

      const resumeAnalysis = candidateRepository.insertResumeAnalysis({
        resume_id: resume.id,
        skills: JSON.stringify(validation.candidate.skills),
        experience: null,
        projects: null,
        summary,
        score: validation.candidate.score,
      });

      if (resumeAnalysis === undefined) {
        throw new Error("Failed to create resume analysis");
      }

      return toCandidateResponse(
        buildCandidateWithAnalysis(candidate, candidateRepository),
      );
    },

    analyzeResume: async (
      user: User,
      body: unknown,
      pdfUrl?: string | null,
    ): Promise<CandidateResponse> => {
      if (user.role !== "candidate") {
        throw new ForbiddenError("Only candidates can submit resumes");
      }

      const validation = validateResumeTextBody(body);

      if (!validation.success) {
        throw new Error(validation.error);
      }

      return saveAnalysis(user, validation.resumeText, pdfUrl);
    },

    uploadPdf: async (
      user: User,
      file: Express.Multer.File | undefined,
      pdfUrl?: string | null,
    ): Promise<CandidateResponse> => {
      if (user.role !== "candidate") {
        throw new ForbiddenError("Only candidates can submit resumes");
      }

      if (file === undefined) {
        throw new Error("PDF file is required");
      }

      const resumeText = await extractPdfTextService(
        await readFile(file.path),
      );

      if (resumeText.length === 0) {
        throw new Error("PDF did not contain extractable text");
      }

      return saveAnalysis(user, resumeText, pdfUrl);
    },
  };
};
