import { useTranslation } from 'react-i18next'

import type { NotificationItem } from '../../types/notification'
import type { User } from '../../types/auth'
import LanguageSwitcher from '../common/LanguageSwitcher'
import ThemeToggle from '../common/ThemeToggle'
import NotificationBell from '../NotificationBell'

interface AppHeaderProps {
  authToken: string
  isAdmin: boolean
  onLogout: () => void
  onNotificationClick: (notification: NotificationItem) => void
  user: User
}

function AppHeader({
  authToken,
  isAdmin,
  onLogout,
  onNotificationClick,
  user,
}: AppHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="card-header">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title text-3xl">
            {isAdmin ? t('header.adminTitle') : t('header.candidateTitle')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <NotificationBell
            authToken={authToken}
            onNotificationClick={(notification) => {
              onNotificationClick(notification)
            }}
          />
          <div className="card-base flex items-center gap-3 bg-[var(--color-surface-muted)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text-main)]">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted">
                {user.email}
              </p>
            </div>
            <span
              className={`badge-status px-2.5 py-1 text-xs ${
                user.role === 'admin'
                  ? 'badge-status-info'
                  : 'badge-status-success'
              }`}
            >
              {t(`common.roles.${user.role}`)}
            </span>
          </div>
          <button
            className="btn-neutral"
            onClick={onLogout}
            type="button"
          >
            {t('header.logout')}
          </button>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
