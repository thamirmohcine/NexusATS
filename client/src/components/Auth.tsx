import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  AuthFormState,
  AuthMode,
  AuthResponse,
  RegisterUserInput,
} from '../types/auth'
import AuthForm from './auth/AuthForm'

interface AuthProps {
  onLogin: (email: string, password: string) => Promise<AuthResponse>
  onRegister: (input: RegisterUserInput) => Promise<AuthResponse>
}

const initialFormState: AuthFormState = {
  name: '',
  email: '',
  password: '',
  role: 'candidate',
}

function Auth({ onLogin, onRegister }: AuthProps) {
  const { t } = useTranslation()
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [formState, setFormState] = useState<AuthFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const updateFormField = (
    fieldName: keyof AuthFormState,
    value: string,
  ): void => {
    setFormState((currentFormState) => ({
      ...currentFormState,
      [fieldName]: value,
    }))
  }

  const handleModeChange = (nextMode: AuthMode): void => {
    setAuthMode(nextMode)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleAuthenticationSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      if (authMode === 'login') {
        await onLogin(formState.email.trim(), formState.password)
      } else {
        await onRegister({
          name: formState.name.trim(),
          email: formState.email.trim(),
          password: formState.password,
          role: formState.role,
        })
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('auth.errors.authentication'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthForm
      authMode={authMode}
      errorMessage={errorMessage}
      formState={formState}
      isSubmitting={isSubmitting}
      onAuthenticationSubmit={(event) => {
        void handleAuthenticationSubmit(event)
      }}
      onFieldChange={updateFormField}
      onModeChange={handleModeChange}
      successMessage={successMessage}
    />
  )
}

export default Auth
