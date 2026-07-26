import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  ThemeContext,
  THEME_STORAGE_KEY,
  getInitialTheme,
  persistTheme,
  syncThemeClass,
  type Theme,
  type ThemeContextValue,
} from './useTheme'

interface ThemeProviderProps {
  children: ReactNode
}

function readStoredTheme(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function getBrowserInitialTheme(): Theme {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  return getInitialTheme({
    prefersDark,
    storedTheme: readStoredTheme(),
  })
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => getBrowserInitialTheme())

  useEffect(() => {
    syncThemeClass(theme, document.documentElement.classList)

    try {
      persistTheme(window.localStorage, theme)
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
