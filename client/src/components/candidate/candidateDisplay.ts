import type { ScoreTone } from '../../candidateUtils'

export const scoreToneClasses: Record<ScoreTone, string> = {
  green: 'badge-status-success',
  yellow: 'badge-status-warning',
  red: 'badge-status-danger',
}

export const formatCandidateDate = (
  createdAt: string,
  locale = 'en',
  fallback = 'Unknown date',
): string => {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export const getPhoneHref = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, '')}`
