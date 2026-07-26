import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useNotifications } from '../hooks/useNotifications'
import type { NotificationItem } from '../types/notification'

interface NotificationBellProps {
  authToken: string
  onNotificationClick?: (notification: NotificationItem) => void
}

const formatNotificationTime = (
  createdAt: string,
  locale: string,
  fallback: string,
): string => {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function NotificationBell({
  authToken,
  onNotificationClick,
}: NotificationBellProps) {
  const { i18n, t } = useTranslation()
  const timeLocale = i18n.resolvedLanguage ?? i18n.language
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const {
    badgeText,
    errorMessage,
    isLoading,
    isMarkingRead,
    markAllAsRead,
    markOneAsRead,
    notifications,
    unreadCount,
  } = useNotifications(authToken)

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (
        rootRef.current !== null &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  const handleMarkAsRead = async (): Promise<void> => {
    await markAllAsRead()
    setIsOpen(false)
  }

  const handleNotificationClick = async (
    notification: NotificationItem,
  ): Promise<void> => {
    onNotificationClick?.(notification)
    setIsOpen(false)
    await markOneAsRead(notification)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0
            ? t('notifications.labelWithCount', { count: unreadCount })
            : t('notifications.label')
        }
        className="btn-icon relative h-11 w-11"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        title={t('notifications.label')}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="notification-count">
            {badgeText}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="card-base absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden">
          <div className="card-header flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <h2 className="section-title text-sm">
                {t('notifications.title')}
              </h2>
              <p className="text-xs text-muted">
                {t('notifications.unread', { count: unreadCount })}
              </p>
            </div>
            <button
              className="btn-neutral text-xs disabled:opacity-60"
              disabled={unreadCount === 0 || isMarkingRead}
              onClick={() => {
                void handleMarkAsRead()
              }}
              type="button"
            >
              {isMarkingRead
                ? t('notifications.marking')
                : t('notifications.markAsRead')}
            </button>
          </div>

          {errorMessage ? (
            <p className="status-alert status-alert-error rounded-none border-x-0 border-t-0">
              {errorMessage}
            </p>
          ) : null}

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div
                    className="h-16 animate-pulse rounded-lg bg-[var(--color-surface-muted)]"
                    key={item}
                  />
                ))}
              </div>
            ) : null}

            {!isLoading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {t('notifications.none')}
              </p>
            ) : null}

            {!isLoading && notifications.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)]">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition hover:bg-[var(--color-surface-muted)] focus:ring-4 focus:ring-inset focus:ring-[var(--focus-secondary)]"
                      onClick={() => {
                        void handleNotificationClick(notification)
                      }}
                      type="button"
                    >
                      <span className="notification-dot" />
                      <div className="min-w-0">
                        <p className="section-title text-sm">
                          {t(`notifications.types.${notification.type}`, {
                            defaultValue: notification.title,
                          })}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">
                          {notification.content}
                        </p>
                        <p className="mt-2 text-xs font-medium text-[var(--color-text-subtle)]">
                          {formatNotificationTime(
                            notification.created_at,
                            timeLocale,
                            t('common.justNow'),
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationBell
