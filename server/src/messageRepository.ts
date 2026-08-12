import type { Pool } from "pg";

import type { CreateMessageInput, Message } from "./db.js";

export interface MessageRepository {
  createMessage: (input: CreateMessageInput) => Promise<Message | undefined>;
  getMessagesByCandidateId: (candidateId: number) => Promise<Message[]>;
  markMessagesAsReadForUser: (candidateId: number, userId: number) => Promise<number>;
}

export const createMessageRepository = (database: Pool): MessageRepository => {
  const createMessage = async (
    input: CreateMessageInput,
  ): Promise<Message | undefined> => {
    const { rows } = await database.query<Message>(
      `INSERT INTO messages (sender_id, receiver_id, candidate_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, sender_id, receiver_id, candidate_id, content, is_read, created_at`,
      [input.sender_id, input.receiver_id, input.candidate_id, input.content],
    );

    return rows[0];
  };

  const getMessagesByCandidateId = async (
    candidateId: number,
  ): Promise<Message[]> => {
    const { rows } = await database.query<Message>(
      `SELECT id, sender_id, receiver_id, candidate_id, content, is_read, created_at
      FROM messages
      WHERE candidate_id = $1
      ORDER BY created_at ASC, id ASC`,
      [candidateId],
    );

    return rows;
  };

  const markMessagesAsReadForUser = async (
    candidateId: number,
    userId: number,
  ): Promise<number> => {
    const result = await database.query(
      `UPDATE messages
      SET is_read = 1
      WHERE candidate_id = $1
        AND receiver_id = $2
        AND is_read = 0`,
      [candidateId, userId],
    );

    return result.rowCount ?? 0;
  };

  return {
    createMessage,
    getMessagesByCandidateId,
    markMessagesAsReadForUser,
  };
};
