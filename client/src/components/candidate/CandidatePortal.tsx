import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getCandidatePdfUrl,
  getLocalizedSummary,
  getScoreTone,
} from '../../candidateUtils'
import type { Candidate } from '../../types/candidate'
import { FileTextIcon, MessageIcon, TrashIcon } from '../ui/icons'
import {
  formatCandidateDate,
  scoreToneClasses,
} from './candidateDisplay'

interface CandidatePortalProps {
  candidate: Candidate | null
  isAnalyzing: boolean
  isDeleting: boolean
  isUploadingPdf: boolean
  onAnalyzeResume: (resumeText: string) => Promise<boolean>
  onDeleteCandidate: (candidate: Candidate) => void
  onOpenChat: (candidate: Candidate) => void
  onUploadPdf: (file: File) => Promise<boolean>
}

const formCardClassName = 'card-base h-fit p-5'

function CandidatePortal({
  candidate,
  isAnalyzing,
  isDeleting,
  isUploadingPdf,
  onAnalyzeResume,
  onDeleteCandidate,
  onOpenChat,
  onUploadPdf,
}: CandidatePortalProps) {
  const { t } = useTranslation()
  const [resumeText, setResumeText] = useState('')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [pdfInputKey, setPdfInputKey] = useState(0)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  const handleAnalyzeResume = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()

    if (await onAnalyzeResume(resumeText)) {
      setResumeText('')
    }
  }

  const handleUploadPdf = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()

    if (selectedPdfFile === null) {
      return
    }

    if (await onUploadPdf(selectedPdfFile)) {
      setSelectedPdfFile(null)
      setPdfInputKey((currentKey) => currentKey + 1)
    }
  }

  const handleBrowsePdf = (): void => {
    pdfInputRef.current?.click()
  }

  return (
    <>
      <section className={formCardClassName}>
        <div className="mb-5">
          <h2 className="section-title text-xl">
            {t('candidatePortal.submitTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('candidatePortal.submitDescription')}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAnalyzeResume}>
          <label
            className="field-label"
            htmlFor="resumeText"
          >
            {t('candidatePortal.resumeText')}
          </label>
          <textarea
            className="input-field min-h-72 resize-y leading-6"
            disabled={isAnalyzing}
            id="resumeText"
            name="resumeText"
            onChange={(event) => setResumeText(event.target.value)}
            placeholder={t('candidatePortal.resumePlaceholder')}
            value={resumeText}
          />

          <button
            className="btn-primary w-full sm:w-auto"
            disabled={isAnalyzing}
            type="submit"
          >
            {isAnalyzing
              ? t('candidatePortal.analyzing')
              : t('candidatePortal.analyzeResume')}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-(--color-border)" />
          <span className="text-xs font-medium uppercase tracking-normal text-text-subtle">
            {t('candidatePortal.dividerOr')}
          </span>
          <div className="h-px flex-1 bg-(--color-border)" />
        </div>

        <form className="space-y-4" onSubmit={handleUploadPdf}>
          <label
            className="field-label"
            htmlFor="resumePdf"
          >
            {t('candidatePortal.pdfResume')}
          </label>
          <input
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={isUploadingPdf}
            id="resumePdf"
            key={pdfInputKey}
            name="resumePdf"
            onChange={(event) =>
              setSelectedPdfFile(event.target.files?.[0] ?? null)
            }
            type="file"
            ref={pdfInputRef}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="btn-neutral w-full sm:w-auto"
              disabled={isUploadingPdf}
              onClick={handleBrowsePdf}
              type="button"
            >
              <FileTextIcon />
              {t('candidatePortal.browseFiles')}
            </button>
            <p className="text-sm text-muted" aria-live="polite">
              {selectedPdfFile
                ? t('candidatePortal.selectedFile', {
                    fileName: selectedPdfFile.name,
                  })
                : t('candidatePortal.noFileSelected')}
            </p>
          </div>

          <button
            className="btn-secondary w-full sm:w-auto"
            disabled={isUploadingPdf || selectedPdfFile === null}
            type="submit"
          >
            {isUploadingPdf
              ? t('candidatePortal.uploadingPdf')
              : t('candidatePortal.uploadAnalyzePdf')}
          </button>
        </form>
      </section>

      <CandidatePortalProfile
        candidate={candidate}
        isDeleting={isDeleting}
        onDeleteCandidate={onDeleteCandidate}
        onOpenChat={onOpenChat}
      />
    </>
  )
}

function CandidatePortalProfile({
  candidate,
  isDeleting,
  onDeleteCandidate,
  onOpenChat,
}: {
  candidate: Candidate | null
  isDeleting: boolean
  onDeleteCandidate: (candidate: Candidate) => void
  onOpenChat: (candidate: Candidate) => void
}) {
  const { i18n, t } = useTranslation()

  if (candidate === null) {
    return (
      <section className="empty-state h-fit">
        <h2 className="section-title text-xl">
          {t('candidatePortal.profileTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t('candidatePortal.emptyProfile')}
        </p>
      </section>
    )
  }

  const scoreValue = candidate.score ?? 0
  const scoreTone = getScoreTone(scoreValue)
  const pdfUrl = getCandidatePdfUrl(candidate)
  const dateLocale = i18n.resolvedLanguage ?? i18n.language
  const localizedSummary = getLocalizedSummary(candidate.summary, dateLocale)

  return (
    <section className={formCardClassName}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="section-eyebrow">
            {t('candidatePortal.analyzedProfile')}
          </p>
          <h2 className="section-title mt-1 truncate text-2xl">
            {candidate.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatCandidateDate(
              candidate.created_at,
              dateLocale,
              t('common.unknownDate'),
            )}
          </p>
        </div>
        <span
          className={`badge-status ${scoreToneClasses[scoreTone]}`}
        >
          {t('common.score', {
            score: candidate.score ?? t('common.notAvailable'),
          })}
        </span>
      </div>

      <p className="mt-5 text-sm leading-6 text-[var(--color-text-muted)]">
        {localizedSummary ?? t('candidatePortal.noSummary')}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {candidate.skills.length > 0 ? (
          candidate.skills.map((skill) => (
            <span
              className="badge-skill"
              key={`${candidate.id}-candidate-${skill}`}
            >
              {skill}
            </span>
          ))
        ) : (
          <p className="text-sm text-muted">{t('candidatePortal.noSkills')}</p>
        )}
      </div>

      {pdfUrl ? (
        <a
          className="btn-neutral mt-5"
          href={pdfUrl}
          rel="noreferrer"
          target="_blank"
        >
          <FileTextIcon />
          {t('candidatePortal.openUploadedPdf')}
        </a>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4">
        <button
          className="btn-accent btn-accent-sm"
          onClick={() => onOpenChat(candidate)}
          type="button"
        >
          <MessageIcon />
          {t('candidatePortal.contactAdmin')}
        </button>
        <button
          className="btn-danger btn-danger-sm disabled:opacity-60"
          disabled={isDeleting}
          onClick={() => onDeleteCandidate(candidate)}
          type="button"
        >
          <TrashIcon />
          {isDeleting
            ? t('candidatePortal.deleting')
            : t('candidatePortal.deleteProfile')}
        </button>
      </div>
    </section>
  )
}

export default CandidatePortal
