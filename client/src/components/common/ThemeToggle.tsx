import { useTranslation } from 'react-i18next'

import { useTheme } from '../../hooks/useTheme'
import { MoonIcon, SunIcon } from '../ui/icons'

function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')

  return (
    <button
      aria-label={label}
      className="btn-icon"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export default ThemeToggle
