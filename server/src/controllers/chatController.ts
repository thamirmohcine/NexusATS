import type { Request, Response } from "express";

import type { CandidateRepository } from "../candidateRepository.js";
import type { Message, User } from "../db.js";
import { type ErrorResponse, parsePositiveInteger, sendSuccess } from "../http.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import {
  type ChatService,
  validateSendMessageBody,
} from "../services/chatService.js";

interface CreateChatControllerOptions {
  candidateRepository: CandidateRepository;
  chatService: ChatService;
}

export interface ChatController {
  sendMessage: (
    request: Request<Record<string, never>, Message | ErrorResponse, unknown>,
    response: Response<Message | ErrorResponse>,
  ) => Promise<void>;
  getMessages: (
    request: Request<{ candidate_id: string }, Message[] | ErrorResponse, unknown>,
    response: Response<Message[] | ErrorResponse>,
  ) => Promise<void>;
}

const canAccessCandidateChat = async (
  user: User,
  candidateId: number,
  candidateRepository: CandidateRepository,
): Promise<boolean> => {
  const candidate = await candidateRepository.getCandidateById(candidateId);

  if (candidate === undefined) return false;

  return user.role === "admin" || candidate.user_id === user.id;
};

export const createChatController = ({
  candidateRepository,
  chatService,
}: CreateChatControllerOptions): ChatController => ({
  sendMessage: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    const validation = validateSendMessageBody(request.body);

    if (!validation.success) {
      response.status(400).json({ error: validation.error });
      return;
    }

    if (
      !(await canAccessCandidateChat(
        user,
        validation.body.candidateId,
        candidateRepository,
      ))
    ) {
      response.status(404).json({ error: "Candidate not found" });
      return;
    }

    const message = await chatService.sendMessage({
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      receiverId: validation.body.receiverId,
      candidateId: validation.body.candidateId,
      content: validation.body.content,
    });

    if (message === undefined) {
      response.status(500).json({ error: "Failed to send message" });
      return;
    }

    sendSuccess(response, message, 201);
  },

  getMessages: async (request, response): Promise<void> => {
    const user = getAuthenticatedUser(request);

    if (user === null) {
      response.status(401).json({ error: "Authorization token is required" });
      return;
    }

    const candidateId = parsePositiveInteger(request.params.candidate_id);

    if (candidateId === null) {
      response.status(404).json({ error: "Candidate not found" });
      return;
    }

    if (!(await canAccessCandidateChat(user, candidateId, candidateRepository))) {
      response.status(404).json({ error: "Candidate not found" });
      return;
    }

    sendSuccess(response, await chatService.getMessages(user, candidateId));
  },
});
