export type UserRole = 'candidate' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  token: string
  user: User
}

export interface AuthSession {
  token: string
  user: User
}

export interface RegisterUserInput {
  name: string
  email: string
  password: string
  role: UserRole
}

export type AuthMode = 'login' | 'register'

export interface AuthFormState {
  name: string
  email: string
  password: string
  role: UserRole
}
