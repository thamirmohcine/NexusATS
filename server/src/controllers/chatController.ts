import type { Request, Response } from "express";

import type { CandidateRepository } from "../candidateRepository.js";
import type { Message, User } from "../db.js";
import {
  type ErrorResponse,
  isRecord,
  parsePositiveInteger,
  sendError,
} from "../http.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import type { MessageRepository } from "../messageRepository.js";
import type { NotificationRepository } from "../notificationRepository.js";
import type { UserRepository } from "../userRepository.js";

interface SendMessageRequestBody {
  receiver_id: number;
  candidate_id: number;
  content: string;
}

interface CreateChatControllerOptions {
  userRepository: UserRepository;
  candidateRepository: CandidateRepository;
  messageRepository: MessageRepository;
  notificationRepository: NotificationRepository;
}

type SendMessageValidationResult =
  | { success: true; body: SendMessageRequestBody }
  | { success: false; error: string };

export interface ChatController {
  sendMessage: (
    request: Request<Record<string, never>, Message | ErrorResponse, unknown>,
    response: Response<Message | ErrorResponse>,
  ) => void;
  getMessages: (
    request: Request<{ candidate_id: string }, Message[] | ErrorResponse, unknown>,
    response: Response<Message[] | ErrorResponse>,
  ) => void;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const validateSendMessageBody = (
  body: unknown,
): SendMessageValidationResult => {
  if (!isRecord(body)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  if (!isPositiveInteger(body.receiver_id)) {
    return { success: false, error: "Receiver id must be a positive integer" };
  }

  if (!isPositiveInteger(body.candidate_id)) {
    return { success: false, error: "Candidate id must be a positive integer" };
  }

  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return { success: false, error: "Message content is required" };
  }

  return {
    success: true,
    body: {
      receiver_id: body.receiver_id,
      candidate_id: body.candidate_id,
      content: body.content.trim(),
    },
  };
};

const canAccessCandidateChat = (
  user: User,
  candidateId: number,
  candidateRepository: CandidateRepository,
): boolean => {
  const candidate = candidateRepository.getCandidateById(candidateId);

  if (candidate === undefined) {
    return false;
  }

  return user.role === "admin" || candidate.user_id === user.id;
};

const notifyMessageSent = (
  notificationRepository: NotificationRepository,
  sender: User,
  receiverId: number,
  candidateId: number,
): void => {
  notificationRepository.createNotification({
    user_id: sender.role === "candidate" ? null : receiverId,
    target_role: sender.role === "candidate" ? "admin" : null,
    candidate_id: candidateId,
    sender_id: sender.id,
    type: "message",
    title: "New message",
    content: `${sender.name} sent a message.`,
  });
};

export const createChatController = ({
  userRepository,
  candidateRepository,
  messageRepository,
  notificationRepository,
}: CreateChatControllerOptions): ChatController => ({
  sendMessage: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    const validation = validateSendMessageBody(request.body);

    if (!validation.success) {
      sendError(response, 400, validation.error);
      return;
    }

    if (
      !canAccessCandidateChat(
        user,
        validation.body.candidate_id,
        candidateRepository,
      )
    ) {
      sendError(response, 404, "Candidate not found");
      return;
    }

    if (userRepository.getUserById(validation.body.receiver_id) === undefined) {
      sendError(response, 404, "Receiver not found");
      return;
    }

    try {
      const message = messageRepository.createMessage({
        sender_id: user.id,
        receiver_id: validation.body.receiver_id,
        candidate_id: validation.body.candidate_id,
        content: validation.body.content,
      });

      if (message === undefined) {
        sendError(response, 500, "Failed to send message");
        return;
      }

      notifyMessageSent(
        notificationRepository,
        user,
        validation.body.receiver_id,
        validation.body.candidate_id,
      );

      response.status(201).json(message);
    } catch {
      sendError(response, 500, "Failed to send message");
    }
  },
  getMessages: (request, response): void => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      sendError(response, 401, "Authorization token is required");
      return;
    }

    const candidateId = parsePositiveInteger(request.params.candidate_id);

    if (candidateId === null) {
      sendError(response, 404, "Candidate not found");
      return;
    }

    if (!canAccessCandidateChat(user, candidateId, candidateRepository)) {
      sendError(response, 404, "Candidate not found");
      return;
    }

    try {
      messageRepository.markMessagesAsReadForUser(candidateId, user.id);
      response
        .status(200)
        .json(messageRepository.getMessagesByCandidateId(candidateId));
    } catch {
      sendError(response, 500, "Failed to fetch messages");
    }
  },
});
