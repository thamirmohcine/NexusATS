import { type ChangeEvent, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyDocumentLanguage,
  resolveLanguage,
  supportedLanguages,
} from '../../i18n'
import type { SupportedLanguageCode } from '../../i18n'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const activeLanguage = resolveLanguage(i18n.resolvedLanguage ?? i18n.language)

  useEffect(() => {
    applyDocumentLanguage(activeLanguage)
  }, [activeLanguage])

  const handleLanguageChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ): void => {
    void i18n.changeLanguage(event.target.value as SupportedLanguageCode)
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        className="input-field w-auto min-w-32 py-2 font-medium"
        onChange={handleLanguageChange}
        value={activeLanguage}
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {t(language.labelKey)} / {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}

export default LanguageSwitcher
