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
  ): void;

  notifyMessageSent(
    senderName: string,
    senderRole: "candidate" | "admin",
    senderId: number,
    receiverId: number,
    candidateId: number,
  ): void;

  createNotification(input: CreateNotificationInput): void;
}

export const createNotificationService = (
  notificationRepository: NotificationRepository,
): NotificationService => ({
  notifyCandidateApplication: (
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
  },

  notifyMessageSent: (
    senderName: string,
    senderRole: "candidate" | "admin",
    senderId: number,
    receiverId: number,
    candidateId: number,
  ): void => {
    notificationRepository.createNotification({
      user_id: senderRole === "candidate" ? null : receiverId,
      target_role: senderRole === "candidate" ? "admin" : null,
      candidate_id: candidateId,
      sender_id: senderId,
      type: "message",
      title: "New message",
      content: `${senderName} sent a message.`,
    });
  },

  createNotification: (input: CreateNotificationInput): void => {
    notificationRepository.createNotification(input);
  },
});
