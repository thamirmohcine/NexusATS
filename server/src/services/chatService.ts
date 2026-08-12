import type { CandidateRepository } from "../candidateRepository.js";
import type { Message, User } from "../db.js";
import { NotFoundError } from "../errors/AppError.js";
import { isRecord } from "../http.js";
import type { MessageRepository } from "../messageRepository.js";
import type { NotificationService } from "./notificationService.js";
import type { UserRepository } from "../userRepository.js";

export interface SendMessageInput {
  senderId: number;
  senderName: string;
  senderRole: "candidate" | "admin";
  receiverId: number;
  candidateId: number;
  content: string;
}

interface ValidatedMessageBody {
  receiverId: number;
  candidateId: number;
  content: string;
}

interface SendMessageValidationResult {
  success: true;
  body: ValidatedMessageBody;
}

export type SendMessageValidation =
  | SendMessageValidationResult
  | { success: false; error: string };

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const validateSendMessageBody = (
  body: unknown,
): SendMessageValidation => {
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
      receiverId: body.receiver_id,
      candidateId: body.candidate_id,
      content: body.content.trim(),
    },
  };
};

// ── Service Factory ────────────────────────────────────────────────────

export interface ChatService {
  sendMessage(input: SendMessageInput): Promise<Message | undefined>;
  getMessages(
    user: User,
    candidateId: number,
  ): Promise<Message[]>;
}

interface CreateChatServiceOptions {
  userRepository: UserRepository;
  messageRepository: MessageRepository;
  notificationService: NotificationService;
}

export const createChatService = ({
  userRepository,
  messageRepository,
  notificationService,
}: CreateChatServiceOptions): ChatService => ({
  sendMessage: async (input: SendMessageInput): Promise<Message | undefined> => {
    if ((await userRepository.getUserById(input.receiverId)) === undefined) {
      throw new NotFoundError("Receiver not found");
    }

    const message = await messageRepository.createMessage({
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      candidate_id: input.candidateId,
      content: input.content,
    });

    if (message === undefined) {
      return undefined;
    }

    await notificationService.notifyMessageSent(
      input.senderName,
      input.senderRole,
      input.senderId,
      input.receiverId,
      input.candidateId,
    );

    return message;
  },

  getMessages: async (
    user: User,
    candidateId: number,
  ): Promise<Message[]> => {
    await messageRepository.markMessagesAsReadForUser(candidateId, user.id);

    return messageRepository.getMessagesByCandidateId(candidateId);
  },
});
