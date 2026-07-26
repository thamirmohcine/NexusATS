import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  analyzeResume as analyzeResumeService,
  deleteCandidate as deleteCandidateService,
  fetchCandidates,
  uploadPdfResume,
} from '../services/candidateService'
import { fetchAdminUsers } from '../services/authService'
import {
  candidateMatchesSearch,
  sortCandidates,
  type CandidateSortOption,
} from '../candidateUtils'
import type { AuthSession, User } from '../types/auth'
import type { Candidate } from '../types/candidate'

export interface StatusMessage {
  type: 'error' | 'success'
  text: string
}

export interface UseCandidatesResult {
  adminUsers: User[]
  candidateProfile: Candidate | null
  candidateSortOption: CandidateSortOption
  candidates: Candidate[]
  clearCandidateState: () => void
  deleteCandidate: (candidate: Candidate) => Promise<boolean>
  isAnalyzing: boolean
  isDeletingCandidateId: number | null
  isLoadingCandidates: boolean
  isUploadingPdf: boolean
  refreshCandidates: () => Promise<Candidate[]>
  searchTerm: string
  setCandidateProfile: Dispatch<SetStateAction<Candidate | null>>
  setCandidateSortOption: Dispatch<SetStateAction<CandidateSortOption>>
  setCandidates: Dispatch<SetStateAction<Candidate[]>>
  setSearchTerm: Dispatch<SetStateAction<string>>
  setStatusMessage: Dispatch<SetStateAction<StatusMessage | null>>
  statusMessage: StatusMessage | null
  submitResumeText: (resumeText: string) => Promise<boolean>
  uploadResumePdf: (file: File) => Promise<boolean>
  visibleCandidates: Candidate[]
}

const getActionErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}

export function useCandidates(
  authSession: AuthSession | null,
): UseCandidatesResult {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateProfile, setCandidateProfile] = useState<Candidate | null>(
    null,
  )
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [candidateSortOption, setCandidateSortOption] =
    useState<CandidateSortOption>('newest-first')
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [isDeletingCandidateId, setIsDeletingCandidateId] = useState<
    number | null
  >(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  )

  const visibleCandidates = useMemo(
    () =>
      sortCandidates(
        candidates.filter((candidate) =>
          candidateMatchesSearch(candidate, searchTerm),
        ),
        candidateSortOption,
      ),
    [candidates, candidateSortOption, searchTerm],
  )

  const addOrUpdateCandidate = (candidateToSave: Candidate): void => {
    setCandidates((currentCandidates) => [
      candidateToSave,
      ...currentCandidates.filter(
        (candidate) => candidate.id !== candidateToSave.id,
      ),
    ])
  }

  const clearCandidateState = (): void => {
    setCandidates([])
    setCandidateProfile(null)
    setAdminUsers([])
    setSearchTerm('')
    setStatusMessage(null)
  }

  const refreshCandidates = async (): Promise<Candidate[]> => {
    if (authSession === null) {
      return []
    }

    const loadedCandidates = await fetchCandidates(authSession.token)

    if (authSession.user.role === 'admin') {
      setCandidates(loadedCandidates)
    } else {
      setCandidates([])
      setCandidateProfile(loadedCandidates[0] ?? null)
    }

    return loadedCandidates
  }

  useEffect(() => {
    if (authSession === null) {
      return undefined
    }

    let shouldUpdate = true

    const loadCandidates = async (): Promise<void> => {
      setIsLoadingCandidates(true)

      try {
        const loadedCandidates = await fetchCandidates(authSession.token)

        if (shouldUpdate) {
          if (authSession.user.role === 'admin') {
            setCandidates(loadedCandidates)
          } else {
            setCandidates([])
            setCandidateProfile(loadedCandidates[0] ?? null)
          }
        }
      } catch {
        if (shouldUpdate) {
          setStatusMessage({
            type: 'error',
            text: t('status.unableLoadCandidates'),
          })
        }
      } finally {
        if (shouldUpdate) {
          setIsLoadingCandidates(false)
        }
      }
    }

    void loadCandidates()

    return () => {
      shouldUpdate = false
    }
  }, [authSession, t])

  useEffect(() => {
    if (authSession === null || authSession.user.role !== 'candidate') {
      return undefined
    }

    let shouldUpdate = true

    const loadAdmins = async (): Promise<void> => {
      try {
        const loadedAdmins = await fetchAdminUsers(authSession.token)

        if (shouldUpdate) {
          setAdminUsers(loadedAdmins)
        }
      } catch {
        if (shouldUpdate) {
          setAdminUsers([])
        }
      }
    }

    void loadAdmins()

    return () => {
      shouldUpdate = false
    }
  }, [authSession])

  const submitResumeText = async (resumeText: string): Promise<boolean> => {
    const trimmedResumeText = resumeText.trim()

    if (trimmedResumeText.length === 0) {
      setStatusMessage({
        type: 'error',
        text: t('status.pasteResumeText'),
      })
      return false
    }

    if (authSession === null) {
      setStatusMessage({
        type: 'error',
        text: t('status.authRequired'),
      })
      return false
    }

    setIsAnalyzing(true)
    setStatusMessage(null)

    try {
      const createdCandidate = await analyzeResumeService(
        trimmedResumeText,
        authSession.token,
      )

      if (authSession.user.role === 'candidate') {
        setCandidateProfile(createdCandidate)
      } else {
        addOrUpdateCandidate(createdCandidate)
      }

      setStatusMessage({
        type: 'success',
        text:
          authSession.user.role === 'candidate'
            ? t('status.candidateProfileAnalyzed')
            : t('status.adminCandidateAdded', { name: createdCandidate.name }),
      })
      return true
    } catch {
      setStatusMessage({
        type: 'error',
        text: t('status.unableAnalyze'),
      })
      return false
    } finally {
      setIsAnalyzing(false)
    }
  }

  const uploadResumePdf = async (file: File): Promise<boolean> => {
    if (authSession === null) {
      setStatusMessage({
        type: 'error',
        text: t('status.authRequired'),
      })
      return false
    }

    setIsUploadingPdf(true)
    setStatusMessage(null)

    try {
      const createdCandidate = await uploadPdfResume(file, authSession.token)

      if (authSession.user.role === 'candidate') {
        setCandidateProfile(createdCandidate)
      } else {
        addOrUpdateCandidate(createdCandidate)
      }

      setStatusMessage({
        type: 'success',
        text:
          authSession.user.role === 'candidate'
            ? t('status.candidatePdfUploaded')
            : t('status.adminCandidatePdfAdded', {
                name: createdCandidate.name,
              }),
      })
      return true
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: getActionErrorMessage(
          error,
          t('status.unableUploadPdf'),
        ),
      })
      return false
    } finally {
      setIsUploadingPdf(false)
    }
  }

  const deleteCandidate = async (candidate: Candidate): Promise<boolean> => {
    if (isDeletingCandidateId !== null) {
      return false
    }

    if (authSession === null) {
      setStatusMessage({
        type: 'error',
        text: t('status.signInDelete'),
      })
      return false
    }

    setIsDeletingCandidateId(candidate.id)
    setStatusMessage(null)

    try {
      await deleteCandidateService(candidate.id, authSession.token)
      setCandidates((currentCandidates) =>
        currentCandidates.filter(
          (currentCandidate) => currentCandidate.id !== candidate.id,
        ),
      )
      setCandidateProfile((currentCandidate) =>
        currentCandidate?.id === candidate.id ? null : currentCandidate,
      )
      setStatusMessage({
        type: 'success',
        text:
          authSession.user.role === 'candidate'
            ? t('status.candidateProfileDeleted')
            : t('status.adminCandidateDeleted', { name: candidate.name }),
      })
      return true
    } catch {
      setStatusMessage({
        type: 'error',
        text: t('status.unableDelete'),
      })
      return false
    } finally {
      setIsDeletingCandidateId(null)
    }
  }

  return {
    adminUsers,
    candidateProfile,
    candidateSortOption,
    candidates,
    clearCandidateState,
    deleteCandidate,
    isAnalyzing,
    isDeletingCandidateId,
    isLoadingCandidates,
    isUploadingPdf,
    refreshCandidates,
    searchTerm,
    setCandidateProfile,
    setCandidateSortOption,
    setCandidates,
    setSearchTerm,
    setStatusMessage,
    statusMessage,
    submitResumeText,
    uploadResumePdf,
    visibleCandidates,
  }
}
