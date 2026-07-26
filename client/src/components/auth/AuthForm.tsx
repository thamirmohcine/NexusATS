import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuthFormState, AuthMode, UserRole } from '../../types/auth'
import LanguageSwitcher from '../common/LanguageSwitcher'

interface AuthFormProps {
  authMode: AuthMode
  errorMessage: string | null
  formState: AuthFormState
  isSubmitting: boolean
  onAuthenticationSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (fieldName: keyof AuthFormState, value: string) => void
  onModeChange: (nextMode: AuthMode) => void
  successMessage: string | null
}

const authModeTitleKeys: Record<AuthMode, string> = {
  login: 'auth.titles.login',
  register: 'auth.titles.register',
}

const inputClassName = 'input-field mt-2'
const fullPrimaryButtonClassName = 'btn-primary w-full'
const alertSuccessClassName = 'status-alert status-alert-success'
const alertErrorClassName = 'status-alert status-alert-error'

function AuthForm({
  authMode,
  errorMessage,
  formState,
  isSubmitting,
  onAuthenticationSubmit,
  onFieldChange,
  onModeChange,
  successMessage,
}: AuthFormProps) {
  const { t } = useTranslation()
  const isLoginMode = authMode === 'login'
  const isRegisterMode = authMode === 'register'

  return (
    <main className="app-shell flex items-center justify-center px-6 py-10">
      <section className="card-base w-full max-w-md p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">
              {t('common.appName')}
            </p>
            <h1 className="section-title mt-1 text-2xl">
              {t(authModeTitleKeys[authMode])}
            </h1>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="segmented-control mb-6">
          <button
            className={`segmented-option ${
              isLoginMode ? 'segmented-option-active' : ''
            }`}
            onClick={() => onModeChange('login')}
            type="button"
          >
            {t('auth.tabs.login')}
          </button>
          <button
            className={`segmented-option ${
              isRegisterMode ? 'segmented-option-active' : ''
            }`}
            onClick={() => onModeChange('register')}
            type="button"
          >
            {t('auth.tabs.register')}
          </button>
        </div>

        <form className="space-y-4" onSubmit={onAuthenticationSubmit}>
          {isRegisterMode ? (
            <label className="block">
              <span className="field-label">{t('auth.fields.name')}</span>
              <input
                className={inputClassName}
                disabled={isSubmitting}
                onChange={(event) =>
                  onFieldChange('name', event.target.value)
                }
                required
                type="text"
                value={formState.name}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="field-label">{t('auth.fields.email')}</span>
            <input
              autoComplete="email"
              className={inputClassName}
              disabled={isSubmitting}
              onChange={(event) =>
                onFieldChange('email', event.target.value)
              }
              required
              type="email"
              value={formState.email}
            />
          </label>

          <label className="block">
            <span className="field-label">
              {t('auth.fields.password')}
            </span>
            <input
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
              className={inputClassName}
              disabled={isSubmitting}
              minLength={1}
              onChange={(event) =>
                onFieldChange('password', event.target.value)
              }
              required
              type="password"
              value={formState.password}
            />
          </label>

          {isRegisterMode ? (
            <label className="block">
              <span className="field-label">{t('auth.fields.role')}</span>
              <select
                className={`${inputClassName} font-medium`}
                disabled={isSubmitting}
                onChange={(event) =>
                  onFieldChange('role', event.target.value as UserRole)
                }
                value={formState.role}
              >
                <option value="candidate">
                  {t('common.roles.candidate')}
                </option>
                <option value="admin">{t('common.roles.admin')}</option>
              </select>
            </label>
          ) : null}

          {successMessage ? (
            <p className={alertSuccessClassName}>
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className={alertErrorClassName}>
              {errorMessage}
            </p>
          ) : null}

          <button
            className={fullPrimaryButtonClassName}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? t('auth.states.pleaseWait')
              : isLoginMode
                ? t('auth.buttons.login')
                : t('auth.buttons.register')}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AuthForm
