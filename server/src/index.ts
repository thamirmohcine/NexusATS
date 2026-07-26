import "dotenv/config";

import cors from "cors";
import express, { type Request, type Response } from "express";

import "./config/db.js";
import { defaultUploadsDirectory } from "./middleware/upload.js";
import authRouter from "./routes/auth.js";
import candidatesRouter from "./routes/candidates.js";
import chatRouter from "./routes/chat.js";
import notificationsRouter from "./routes/notifications.js";

interface HealthResponse {
  status: "ok";
  message: string;
}

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(defaultUploadsDirectory));

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
