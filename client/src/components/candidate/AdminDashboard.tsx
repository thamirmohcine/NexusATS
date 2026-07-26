import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getCandidatePdfUrl,
  getLocalizedSummary,
  getProfileUrl,
  getScoreTone,
  type CandidateSortOption,
} from '../../candidateUtils'
import type { Candidate } from '../../types/candidate'
import {
  DownloadIcon,
  EnvelopeIcon,
  FileTextIcon,
  GitHubIcon,
  LinkedInIcon,
  MessageIcon,
  PhoneIcon,
  TrashIcon,
} from '../ui/icons'
import {
  formatCandidateDate,
  getPhoneHref,
  scoreToneClasses,
} from './candidateDisplay'

interface AdminDashboardProps {
  candidateSortOption: CandidateSortOption
  candidatesCount: number
  isDeletingCandidateId: number | null
  isLoadingCandidates: boolean
  onDeleteCandidate: (candidate: Candidate) => void
  onExportCandidates: () => void
  onOpenChat: (candidate: Candidate) => void
  onOpenProfile: (candidate: Candidate) => void
  onPreviewPdf: (pdfUrl: string) => void
  onSearchTermChange: (searchTerm: string) => void
  onSkillFilter: (skill: string) => void
  onSortOptionChange: (sortOption: CandidateSortOption) => void
  searchTerm: string
  visibleCandidates: Candidate[]
}

const candidateSortOptions: Array<{
  labelKey: string
  value: CandidateSortOption
}> = [
  { labelKey: 'adminDashboard.sortOptions.newestFirst', value: 'newest-first' },
  { labelKey: 'adminDashboard.sortOptions.highestScore', value: 'highest-score' },
  { labelKey: 'adminDashboard.sortOptions.lowestScore', value: 'lowest-score' },
]

const stopAnchorClick = (event: MouseEvent<HTMLAnchorElement>): void => {
  event.stopPropagation()
}

const stopButtonClick = (event: MouseEvent<HTMLButtonElement>): void => {
  event.stopPropagation()
}

function IconLink({
  children,
  href,
  label,
}: {
  children: ReactNode
  href: string
  label: string
}) {
  return (
    <a
      aria-label={label}
      className="icon-link"
      href={href}
      onClick={stopAnchorClick}
      rel="noreferrer"
      target="_blank"
      title={label}
    >
      {children}
    </a>
  )
}

function AdminDashboard({
  candidateSortOption,
  candidatesCount,
  isDeletingCandidateId,
  isLoadingCandidates,
  onDeleteCandidate,
  onExportCandidates,
  onOpenChat,
  onOpenProfile,
  onPreviewPdf,
  onSearchTermChange,
  onSkillFilter,
  onSortOptionChange,
  searchTerm,
  visibleCandidates,
}: AdminDashboardProps) {
  const { i18n, t } = useTranslation()
  const dateLocale = i18n.resolvedLanguage ?? i18n.language

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    candidate: Candidate,
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenProfile(candidate)
    }
  }

  return (
    <section className="min-w-0">
      <div className="card-base mb-5 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title text-xl">
            {t('adminDashboard.processedCandidates')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('adminDashboard.candidateCount', {
              visible: visibleCandidates.length,
              total: candidatesCount,
            })}
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_190px] md:max-w-3xl">
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="sr-only">{t('adminDashboard.searchLabel')}</span>
            <input
              className="input-field"
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t('adminDashboard.searchPlaceholder')}
              type="search"
              value={searchTerm}
            />
          </label>

          <label>
            <span className="sr-only">{t('adminDashboard.sortLabel')}</span>
            <select
              className="input-field font-medium"
              onChange={(event) =>
                onSortOptionChange(event.target.value as CandidateSortOption)
              }
              value={candidateSortOption}
            >
              {candidateSortOptions.map((sortOption) => (
                <option key={sortOption.value} value={sortOption.value}>
                  {t(sortOption.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn-accent w-full"
            disabled={visibleCandidates.length === 0}
            onClick={onExportCandidates}
            type="button"
          >
            <DownloadIcon />
            {t('adminDashboard.exportCandidates')}
          </button>
        </div>
      </div>

      {isLoadingCandidates ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              className="card-base h-40 animate-pulse p-5"
              key={item}
            >
              <div className="h-4 w-1/3 rounded bg-[var(--color-border)]" />
              <div className="mt-4 h-3 w-2/3 rounded bg-[var(--color-surface-muted)]" />
              <div className="mt-8 flex gap-2">
                <div className="h-7 w-20 rounded-full bg-[var(--color-surface-muted)]" />
                <div className="h-7 w-24 rounded-full bg-[var(--color-surface-muted)]" />
                <div className="h-7 w-16 rounded-full bg-[var(--color-surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoadingCandidates && visibleCandidates.length === 0 ? (
        <div className="empty-state">
          <h3 className="section-title text-base">
            {t('adminDashboard.noCandidatesFound')}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {candidatesCount === 0
              ? t('adminDashboard.emptyNoCandidates')
              : t('adminDashboard.emptySearch')}
          </p>
        </div>
      ) : null}

      {!isLoadingCandidates && visibleCandidates.length > 0 ? (
        <div className="grid gap-4">
          {visibleCandidates.map((candidate) => {
            const scoreValue = candidate.score ?? 0
            const scoreTone = getScoreTone(scoreValue)
            const linkedInUrl = getProfileUrl(candidate.linkedin)
            const githubUrl = getProfileUrl(candidate.github)
            const pdfUrl = getCandidatePdfUrl(candidate)
            const isDeletingCandidate = isDeletingCandidateId === candidate.id
            const localizedSummary = getLocalizedSummary(
              candidate.summary,
              dateLocale,
            )

            return (
              <article
                className="card-base card-interactive p-5"
                key={candidate.id}
                onClick={() => onOpenProfile(candidate)}
                onKeyDown={(event) => handleCardKeyDown(event, candidate)}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="section-title truncate text-lg">
                      {candidate.name}
                    </h3>
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

                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.email ? (
                    <a
                      className="badge-chip"
                      href={`mailto:${candidate.email}`}
                      onClick={stopAnchorClick}
                    >
                      <EnvelopeIcon />
                      <span className="truncate">{candidate.email}</span>
                    </a>
                  ) : null}
                  {candidate.phone ? (
                    <a
                      className="badge-chip"
                      href={getPhoneHref(candidate.phone)}
                      onClick={stopAnchorClick}
                    >
                      <PhoneIcon />
                      <span className="truncate">{candidate.phone}</span>
                    </a>
                  ) : null}
                  {linkedInUrl ? (
                    <IconLink
                      href={linkedInUrl}
                      label={t('adminDashboard.candidateLinkedIn', {
                        name: candidate.name,
                      })}
                    >
                      <LinkedInIcon />
                    </IconLink>
                  ) : null}
                  {githubUrl ? (
                    <IconLink
                      href={githubUrl}
                      label={t('adminDashboard.candidateGitHub', {
                        name: candidate.name,
                      })}
                    >
                      <GitHubIcon />
                    </IconLink>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
                  {localizedSummary ?? t('adminDashboard.noSummary')}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {candidate.skills.map((skill) => (
                    <button
                      className="badge-skill badge-skill-interactive"
                      key={`${candidate.id}-${skill}`}
                      onClick={(event) => {
                        stopButtonClick(event)
                        onSkillFilter(skill)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title={t('adminDashboard.filterBySkill', { skill })}
                      type="button"
                    >
                      {skill}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted">
                    {t('adminDashboard.rolesProjects', {
                      roles: candidate.experience.length,
                      projects: candidate.projects.length,
                    })}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-neutral"
                      onClick={(event) => {
                        stopButtonClick(event)
                        onOpenProfile(candidate)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      {t('adminDashboard.viewProfile')}
                    </button>
                    <button
                      aria-label={t('adminDashboard.messageCandidate')}
                      className="btn-accent btn-accent-sm"
                      disabled={candidate.user_id === null}
                      onClick={(event) => {
                        stopButtonClick(event)
                        onOpenChat(candidate)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title={
                        candidate.user_id === null
                          ? t('adminDashboard.profileNotLinked')
                          : t('app.messageCandidateTitle', {
                              name: candidate.name,
                            })
                      }
                      type="button"
                    >
                      <MessageIcon />
                      {t('adminDashboard.messageCandidate')}
                    </button>
                    {pdfUrl ? (
                      <button
                        aria-label={t('adminDashboard.previewCandidatePdf', {
                          name: candidate.name,
                        })}
                        className="btn-secondary btn-secondary-sm"
                        onClick={(event) => {
                          stopButtonClick(event)
                          onPreviewPdf(pdfUrl)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        title={t('adminDashboard.previewCandidatePdf', {
                          name: candidate.name,
                        })}
                        type="button"
                      >
                        <FileTextIcon />
                        {t('adminDashboard.previewPdf')}
                      </button>
                    ) : null}
                    <button
                      aria-label={t('adminDashboard.deleteCandidateLabel', {
                        name: candidate.name,
                      })}
                      className="btn-danger btn-danger-sm disabled:opacity-60"
                      disabled={isDeletingCandidateId !== null}
                      onClick={(event) => {
                        stopButtonClick(event)
                        onDeleteCandidate(candidate)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title={t('adminDashboard.deleteCandidateLabel', {
                        name: candidate.name,
                      })}
                      type="button"
                    >
                      <TrashIcon />
                      {isDeletingCandidate
                        ? t('adminDashboard.deleting')
                        : t('adminDashboard.deleteCandidate')}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

export default AdminDashboard
