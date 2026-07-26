import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
} from '../services/notificationService'
import type { NotificationItem } from '../types/notification'

export interface UseNotificationsResult {
  badgeText: string
  errorMessage: string | null
  isLoading: boolean
  isMarkingRead: boolean
  markAllAsRead: () => Promise<void>
  markOneAsRead: (notification: NotificationItem) => Promise<void>
  notifications: NotificationItem[]
  unreadCount: number
}

export function useNotifications(authToken: string): UseNotificationsResult {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingRead, setIsMarkingRead] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadNotifications = useCallback(
    async (showLoadingState: boolean): Promise<void> => {
      if (showLoadingState) {
        setIsLoading(true)
      }

      try {
        const loadedNotifications = await getNotifications(authToken)
        setNotifications(loadedNotifications)
        setErrorMessage(null)
      } catch {
        setErrorMessage(t('notifications.errors.load'))
      } finally {
        if (showLoadingState) {
          setIsLoading(false)
        }
      }
    },
    [authToken, t],
  )

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadNotifications(true)
    }, 0)
    const pollingId = window.setInterval(() => {
      void loadNotifications(false)
    }, 5000)

    return () => {
      window.clearTimeout(initialLoadId)
      window.clearInterval(pollingId)
    }
  }, [loadNotifications])

  const unreadCount = notifications.length
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount)

  const markAllAsRead = async (): Promise<void> => {
    if (unreadCount === 0 || isMarkingRead) {
      return
    }

    setIsMarkingRead(true)
    setErrorMessage(null)

    try {
      await markNotificationsAsRead(authToken)
      setNotifications([])
    } catch {
      setErrorMessage(t('notifications.errors.markAll'))
    } finally {
      setIsMarkingRead(false)
    }
  }

  const markOneAsRead = async (
    notification: NotificationItem,
  ): Promise<void> => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (currentNotification) => currentNotification.id !== notification.id,
      ),
    )

    try {
      await markNotificationAsRead(notification.id, authToken)
      setErrorMessage(null)
    } catch {
      setErrorMessage(t('notifications.errors.markOne'))
      void loadNotifications(false)
    }
  }

  return {
    badgeText,
    errorMessage,
    isLoading,
    isMarkingRead,
    markAllAsRead,
    markOneAsRead,
    notifications,
    unreadCount,
  }
}
