import type { ChatMessage, SendMessageInput } from '../types/chat'
import { API_BASE_URL, getAuthHeaders, getErrorMessage } from './http'

export async function sendMessage(
  input: SendMessageInput,
  authToken: string,
): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE_URL}/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(authToken),
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to send message'))
  }

  return res.json()
}

export async function getMessages(
  candidateId: number,
  authToken: string,
): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE_URL}/chat/${candidateId}`, {
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch messages'))
  }

  return res.json()
}
