import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'app-theme'

export interface ThemeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ThemeClassList {
  add: (token: string) => void
  remove: (token: string) => void
}

interface InitialThemeOptions {
  prefersDark: boolean
  storedTheme: string | null
}

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function getInitialTheme({
  prefersDark,
  storedTheme,
}: InitialThemeOptions): Theme {
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme
  }

  return prefersDark ? 'dark' : 'light'
}

export function persistTheme(storage: ThemeStorage, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme)
}

export function syncThemeClass(theme: Theme, classList: ThemeClassList): void {
  if (theme === 'dark') {
    classList.add('dark')
    return
  }

  classList.remove('dark')
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return value
}
