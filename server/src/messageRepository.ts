import type Database from "better-sqlite3";

import type { CreateMessageInput, Message } from "./db.js";

export interface MessageRepository {
  createMessage: (input: CreateMessageInput) => Message | undefined;
  getMessagesByCandidateId: (candidateId: number) => Message[];
  markMessagesAsReadForUser: (candidateId: number, userId: number) => number;
}

export const createMessageRepository = (
  database: Database.Database,
): MessageRepository => {
  const selectMessageByIdStatement = database.prepare<[number], Message>(`
    SELECT id, sender_id, receiver_id, candidate_id, content, is_read, created_at
    FROM messages
    WHERE id = ?
  `);

  const insertMessageStatement = database.prepare<CreateMessageInput>(`
    INSERT INTO messages (sender_id, receiver_id, candidate_id, content)
    VALUES (@sender_id, @receiver_id, @candidate_id, @content)
  `);

  const selectMessagesByCandidateIdStatement = database.prepare<
    [number],
    Message
  >(`
    SELECT id, sender_id, receiver_id, candidate_id, content, is_read, created_at
    FROM messages
    WHERE candidate_id = ?
    ORDER BY created_at ASC, id ASC
  `);

  const markMessagesAsReadForUserStatement = database.prepare<[number, number]>(`
    UPDATE messages
    SET is_read = 1
    WHERE candidate_id = ?
      AND receiver_id = ?
      AND is_read = 0
  `);

  const getMessageById = (id: number): Message | undefined =>
    selectMessageByIdStatement.get(id);

  const createMessage = (input: CreateMessageInput): Message | undefined => {
    const result = insertMessageStatement.run(input);

    return getMessageById(Number(result.lastInsertRowid));
  };

  return {
    createMessage,
    getMessagesByCandidateId: (candidateId: number): Message[] =>
      selectMessagesByCandidateIdStatement.all(candidateId),
    markMessagesAsReadForUser: (candidateId: number, userId: number): number =>
      markMessagesAsReadForUserStatement.run(candidateId, userId).changes,
  };
};
