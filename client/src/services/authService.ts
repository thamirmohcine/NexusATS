import type {
  AuthResponse,
  RegisterUserInput,
  User,
} from '../types/auth'
import { API_BASE_URL, getAuthHeaders, getErrorMessage } from './http'

const AUTH_API_URL = `${API_BASE_URL}/auth`

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Login failed'))
  }

  return res.json()
}

export async function registerUser(
  input: RegisterUserInput,
): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Registration failed'))
  }

  return res.json()
}

export async function fetchAdminUsers(authToken: string): Promise<User[]> {
  const res = await fetch(`${AUTH_API_URL}/admins`, {
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch admins'))
  }

  return res.json()
}
