import type { CandidateResponse } from "../candidateResponse.js";
import type {
  NotificationRepository,
  CreateNotificationInput,
} from "../notificationRepository.js";

// ── Service Factory ────────────────────────────────────────────────────

export interface NotificationService {
  notifyCandidateApplication(
    candidate: CandidateResponse,
    senderId: number,
  ): Promise<void>;

  notifyMessageSent(
    senderName: string,
    senderRole: "candidate" | "admin",
    senderId: number,
    receiverId: number,
    candidateId: number,
  ): Promise<void>;

  createNotification(input: CreateNotificationInput): Promise<void>;
}

export const createNotificationService = (
  notificationRepository: NotificationRepository,
): NotificationService => ({
  notifyCandidateApplication: async (
    candidate: CandidateResponse,
    senderId: number,
  ): Promise<void> => {
    await notificationRepository.createNotification({
      user_id: null,
      target_role: "admin",
      candidate_id: candidate.id,
      sender_id: senderId,
      type: "candidate_application",
      title: "New candidate application",
      content: `${candidate.name} submitted a resume.`,
    });
  },

  notifyMessageSent: async (
    senderName: string,
    senderRole: "candidate" | "admin",
    senderId: number,
    receiverId: number,
    candidateId: number,
  ): Promise<void> => {
    await notificationRepository.createNotification({
      user_id: senderRole === "candidate" ? null : receiverId,
      target_role: senderRole === "candidate" ? "admin" : null,
      candidate_id: candidateId,
      sender_id: senderId,
      type: "message",
      title: "New message",
      content: `${senderName} sent a message.`,
    });
  },

  createNotification: async (input: CreateNotificationInput): Promise<void> => {
    await notificationRepository.createNotification(input);
  },
});
