import { Router } from "express";

import db from "../config/db.js";
import {
  createCandidateRepository,
  type CandidateRepository,
} from "../candidateRepository.js";
import { createCandidateController } from "../controllers/candidateController.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import {
  createUploadSinglePdf,
  defaultUploadsDirectory,
} from "../middleware/upload.js";
import {
  createNotificationRepository,
  type NotificationRepository,
} from "../notificationRepository.js";
import { analyzeResume } from "../services/ai.js";
import { extractPdfText } from "../services/pdf.js";
import {
  createCandidateService,
  type AnalyzeResumeService,
  type ExtractPdfTextService,
} from "../services/candidateService.js";
import { createNotificationService } from "../services/notificationService.js";
import {
  createUserRepository,
  type UserRepository,
} from "../userRepository.js";

interface CreateCandidatesRouterOptions {
  jwtSecret?: string;
  candidateRepository?: CandidateRepository;
  userRepository?: UserRepository;
  analyzeResumeService?: AnalyzeResumeService;
  extractPdfTextService?: ExtractPdfTextService;
  notificationRepository?: NotificationRepository;
  uploadsDirectory?: string;
}

const defaultJwtSecret = "development-secret";

export const createCandidatesRouter = ({
  jwtSecret = process.env.JWT_SECRET ?? defaultJwtSecret,
  candidateRepository = createCandidateRepository(db),
  userRepository = createUserRepository(db),
  analyzeResumeService = analyzeResume,
  extractPdfTextService = extractPdfText,
  notificationRepository = createNotificationRepository(db),
  uploadsDirectory = defaultUploadsDirectory,
}: CreateCandidatesRouterOptions = {}): Router => {
  const router = Router();

  const notificationService = createNotificationService(notificationRepository);
  const candidateService = createCandidateService({
    candidateRepository,
    analyzeResumeService,
    extractPdfTextService,
    notificationService,
    uploadsDirectory,
  });
  const controller = createCandidateController({ candidateService });
  const { verifyToken } = createAuthMiddleware({ jwtSecret, userRepository });
  const uploadSinglePdf = createUploadSinglePdf(uploadsDirectory);

  router.get("/", verifyToken, controller.getCandidates);
  router.delete("/:id", verifyToken, controller.deleteCandidate);
  router.post("/", verifyToken, controller.createCandidate);
  router.post("/analyze", verifyToken, controller.analyzeResume);
  router.post(
    "/upload-pdf",
    verifyToken,
    uploadSinglePdf,
    controller.uploadPdf,
  );

  return router;
};

export default createCandidatesRouter();
