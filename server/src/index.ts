import "dotenv/config";

import cors from "cors";
import express, { type Request, type Response } from "express";

import { db, initializeDatabase } from "./config/db.js";
import { createGlobalErrorHandler } from "./middleware/errorHandler.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { defaultUploadsDirectory } from "./middleware/upload.js";
import { createLogger } from "./services/logger.js";
import authRouter from "./routes/auth.js";
import candidatesRouter from "./routes/candidates.js";
import chatRouter from "./routes/chat.js";
import notificationsRouter from "./routes/notifications.js";

interface HealthResponse {
  status: "ok";
  message: string;
}

const logger = createLogger({
  level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ?? "info",
});

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(defaultUploadsDirectory));

// Request logging — captures method, path, status, duration, userId
app.use(createRequestLogger(logger));

app.use("/api/auth", authRouter);
app.use("/api/candidates", candidatesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/notifications", notificationsRouter);

app.get(
  "/api/health",
  (_request: Request, response: Response<HealthResponse>): void => {
    response.status(200).json({
      status: "ok",
      message: "Server is running",
    });
  },
);

// Global error handler — must be registered after all routes
app.use(createGlobalErrorHandler(logger));

const start = async (): Promise<void> => {
  await initializeDatabase(db);
  app.listen(port, () => {
    logger.info("Server started", { port });
  });
};

start().catch((error: unknown) => {
  logger.error("Failed to initialize the database", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
