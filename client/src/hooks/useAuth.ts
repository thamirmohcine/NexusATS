import { useState } from 'react'

import {
  loginUser,
  registerUser,
} from '../services/authService'
import type {
  AuthResponse,
  AuthSession,
  RegisterUserInput,
  User,
  UserRole,
} from '../types/auth'

export const AUTH_TOKEN_STORAGE_KEY = 'aiCandidateScreener.token'
export const AUTH_USER_STORAGE_KEY = 'aiCandidateScreener.user'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isUserRole = (value: unknown): value is UserRole =>
  value === 'candidate' || value === 'admin'

const isStoredUser = (value: unknown): value is User =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.name === 'string' &&
  typeof value.email === 'string' &&
  isUserRole(value.role)

const clearStoredAuthSession = (): void => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  localStorage.removeItem(AUTH_USER_STORAGE_KEY)
}

const storeAuthSession = (authResponse: AuthResponse): void => {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authResponse.token)
  localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify(authResponse.user),
  )
}

const getStoredAuthSession = (): AuthSession | null => {
  const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY)

  if (storedToken === null || storedUser === null) {
    clearStoredAuthSession()
    return null
  }

  try {
    const parsedUser: unknown = JSON.parse(storedUser)

    if (!isStoredUser(parsedUser)) {
      clearStoredAuthSession()
      return null
    }

    return {
      token: storedToken,
      user: parsedUser,
    }
  } catch {
    clearStoredAuthSession()
    return null
  }
}

export interface UseAuthResult {
  authSession: AuthSession | null
  completeAuthentication: (authResponse: AuthResponse) => void
  login: (email: string, password: string) => Promise<AuthResponse>
  logout: () => void
  register: (input: RegisterUserInput) => Promise<AuthResponse>
}

export function useAuth(): UseAuthResult {
  const [authSession, setAuthSession] = useState<AuthSession | null>(
    getStoredAuthSession,
  )

  const completeAuthentication = (authResponse: AuthResponse): void => {
    storeAuthSession(authResponse)
    setAuthSession({
      token: authResponse.token,
      user: authResponse.user,
    })
  }

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthResponse> => {
    const authResponse = await loginUser(email, password)
    completeAuthentication(authResponse)
    return authResponse
  }

  const register = async (
    input: RegisterUserInput,
  ): Promise<AuthResponse> => {
    const authResponse = await registerUser(input)
    completeAuthentication(authResponse)
    return authResponse
  }

  const logout = (): void => {
    clearStoredAuthSession()
    setAuthSession(null)
  }

  return {
    authSession,
    completeAuthentication,
    login,
    logout,
    register,
  }
}
