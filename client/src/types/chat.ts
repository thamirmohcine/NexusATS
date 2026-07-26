export interface ChatMessage {
  id: number
  sender_id: number
  receiver_id: number
  candidate_id: number
  content: string
  is_read: 0 | 1
  created_at: string
}

export interface SendMessageInput {
  receiver_id: number
  candidate_id: number
  content: string
}
