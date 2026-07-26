import type { UserRole } from './auth'

export interface NotificationItem {
  id: number
  user_id: number | null
  target_role: UserRole | null
  candidate_id: number | null
  sender_id: number | null
  type: string
  title: string
  content: string
  is_read: 0 | 1
  created_at: string
}

export interface MarkNotificationsAsReadResponse {
  message: string
}

export interface MarkNotificationAsReadResponse {
  message: string
}
