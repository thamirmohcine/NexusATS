import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import ar from './locales/ar.json'
import en from './locales/en.json'
import fr from './locales/fr.json'

export type SupportedLanguageCode = 'en' | 'fr' | 'ar'
export type TextDirection = 'ltr' | 'rtl'

export interface SupportedLanguage {
  code: SupportedLanguageCode
  labelKey: string
  nativeName: string
}

export const supportedLanguages: SupportedLanguage[] = [
  { code: 'en', labelKey: 'language.english', nativeName: 'English' },
  { code: 'fr', labelKey: 'language.french', nativeName: 'Francais' },
  { code: 'ar', labelKey: 'language.arabic', nativeName: 'العربية' },
]

export const translationResources = {
  en: {
    translation: en,
  },
  fr: {
    translation: fr,
  },
  ar: {
    translation: ar,
  },
} as const

const supportedLanguageCodes = supportedLanguages.map(
  (language) => language.code,
)

export const resolveLanguage = (language: string): SupportedLanguageCode => {
  const baseLanguage = language.split('-')[0]?.toLowerCase()

  if (
    baseLanguage === 'en' ||
    baseLanguage === 'fr' ||
    baseLanguage === 'ar'
  ) {
    return baseLanguage
  }

  return 'en'
}

export const getTextDirection = (language: string): TextDirection =>
  resolveLanguage(language) === 'ar' ? 'rtl' : 'ltr'

export const applyDocumentLanguage = (language: string): void => {
  if (typeof document === 'undefined') {
    return
  }

  const resolvedLanguage = resolveLanguage(language)

  document.documentElement.lang = resolvedLanguage
  document.documentElement.dir = getTextDirection(resolvedLanguage)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: translationResources,
    fallbackLng: 'en',
    supportedLngs: supportedLanguageCodes,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', applyDocumentLanguage)
applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)

export default i18n
