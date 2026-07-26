import type { Candidate, LocalizedSummary } from './types/candidate'

export type ScoreTone = 'green' | 'yellow' | 'red'

export type CandidateSortOption =
  | 'highest-score'
  | 'lowest-score'
  | 'newest-first'

export const getScoreTone = (score: number): ScoreTone => {
  if (score >= 80) {
    return 'green'
  }

  if (score >= 60) {
    return 'yellow'
  }

  return 'red'
}

export const candidateMatchesSearch = (
  candidate: Candidate,
  searchTerm: string,
): boolean => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  if (normalizedSearchTerm.length === 0) {
    return true
  }

  const normalizedName = candidate.name.toLowerCase()
  const normalizedSkills = candidate.skills.map((skill) => skill.toLowerCase())

  return (
    normalizedName.includes(normalizedSearchTerm) ||
    normalizedSkills.some((skill) => skill.includes(normalizedSearchTerm))
  )
}

const getCandidateTimestamp = (candidate: Candidate): number => {
  const timestamp = new Date(candidate.created_at).getTime()

  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const sortCandidates = (
  candidates: Candidate[],
  sortOption: CandidateSortOption,
): Candidate[] =>
  [...candidates].sort((candidateA, candidateB) => {
    const newestFirstDifference =
      getCandidateTimestamp(candidateB) - getCandidateTimestamp(candidateA)

    if (sortOption === 'newest-first') {
      return newestFirstDifference
    }

    if (candidateA.score === null && candidateB.score === null) {
      return newestFirstDifference
    }

    if (candidateA.score === null) {
      return 1
    }

    if (candidateB.score === null) {
      return -1
    }

    const scoreDifference =
      sortOption === 'highest-score'
        ? candidateB.score - candidateA.score
        : candidateA.score - candidateB.score

    return scoreDifference === 0 ? newestFirstDifference : scoreDifference
  })

const escapeCsvCell = (value: string): string => {
  if (!/[",\n\r]/.test(value)) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

export const getLocalizedSummary = (
  summary: LocalizedSummary | null,
  language: string,
): string | null => {
  if (summary === null) {
    return null
  }

  const baseLanguage = language.split('-')[0]?.toLowerCase()
  const localizedSummary =
    baseLanguage === 'ar'
      ? summary.ar
      : baseLanguage === 'fr'
        ? summary.fr
        : summary.en
  const trimmedLocalizedSummary = localizedSummary.trim()

  if (trimmedLocalizedSummary.length > 0) {
    return trimmedLocalizedSummary
  }

  const trimmedEnglishSummary = summary.en.trim()
  return trimmedEnglishSummary.length > 0 ? trimmedEnglishSummary : null
}

export const buildCandidatesCsv = (candidates: Candidate[]): string => {
  const headerRow = ['Name', 'Email', 'Score', 'Skills', 'Summary']
  const candidateRows = candidates.map((candidate) =>
    [
      candidate.name,
      candidate.email ?? '',
      candidate.score === null ? '' : String(candidate.score),
      candidate.skills.join('; '),
      getLocalizedSummary(candidate.summary, 'en') ?? '',
    ]
      .map(escapeCsvCell)
      .join(','),
  )

  return [headerRow.join(','), ...candidateRows].join('\n')
}

export const getProfileUrl = (profileText: string | null): string | null => {
  const trimmedProfileText = profileText?.trim()

  if (!trimmedProfileText) {
    return null
  }

  if (/^https?:\/\//i.test(trimmedProfileText)) {
    return trimmedProfileText
  }

  return `https://${trimmedProfileText}`
}

export const getCandidatePdfUrl = (candidate: Candidate): string | null => {
  const trimmedPdfUrl = candidate.pdf_url?.trim()

  return trimmedPdfUrl && trimmedPdfUrl.length > 0 ? trimmedPdfUrl : null
}
