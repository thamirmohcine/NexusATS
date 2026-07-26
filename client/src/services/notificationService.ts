import type {
  MarkNotificationAsReadResponse,
  MarkNotificationsAsReadResponse,
  NotificationItem,
} from '../types/notification'
import { API_BASE_URL, getAuthHeaders, getErrorMessage } from './http'

export async function getNotifications(
  authToken: string,
): Promise<NotificationItem[]> {
  const res = await fetch(`${API_BASE_URL}/notifications`, {
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(
      await getErrorMessage(res, 'Failed to fetch notifications'),
    )
  }

  return res.json()
}

export async function markNotificationsAsRead(
  authToken: string,
): Promise<MarkNotificationsAsReadResponse> {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(
      await getErrorMessage(res, 'Failed to mark notifications as read'),
    )
  }

  return res.json()
}

export async function markNotificationAsRead(
  notificationId: number,
  authToken: string,
): Promise<MarkNotificationAsReadResponse> {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(
      await getErrorMessage(res, 'Failed to mark notification as read'),
    )
  }

  return res.json()
}
