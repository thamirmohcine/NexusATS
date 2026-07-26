import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getLocalizedSummary,
  getProfileUrl,
  getScoreTone,
} from '../../candidateUtils'
import type { Candidate } from '../../types/candidate'
import {
  CloseIcon,
  EnvelopeIcon,
  GitHubIcon,
  LinkedInIcon,
  MessageIcon,
  PhoneIcon,
} from '../ui/icons'
import {
  formatCandidateDate,
  getPhoneHref,
  scoreToneClasses,
} from './candidateDisplay'

interface CandidateProfileModalProps {
  candidate: Candidate
  onClose: () => void
  onOpenChat: (candidate: Candidate) => void
  onSkillFilter: (skill: string) => void
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
      rel="noreferrer"
      target="_blank"
      title={label}
    >
      {children}
    </a>
  )
}

function CandidateProfileModal({
  candidate,
  onClose,
  onOpenChat,
  onSkillFilter,
}: CandidateProfileModalProps) {
  const { i18n, t } = useTranslation()
  const scoreValue = candidate.score ?? 0
  const scoreTone = getScoreTone(scoreValue)
  const linkedInUrl = getProfileUrl(candidate.linkedin)
  const githubUrl = getProfileUrl(candidate.github)
  const dateLocale = i18n.resolvedLanguage ?? i18n.language
  const localizedSummary = getLocalizedSummary(candidate.summary, dateLocale)

  return (
    <div
      aria-labelledby="candidate-profile-title"
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={onClose}
      role="dialog"
    >
      <div
        className="modal-content max-h-[92vh] max-w-4xl overflow-y-auto"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="card-header sticky top-0 z-10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">
                {formatCandidateDate(
                  candidate.created_at,
                  dateLocale,
                  t('common.unknownDate'),
                )}
              </p>
              <h2
                className="section-title mt-1 truncate text-2xl"
                id="candidate-profile-title"
              >
                {candidate.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                className="btn-accent btn-accent-sm"
                disabled={candidate.user_id === null}
                onClick={() => onOpenChat(candidate)}
                title={
                  candidate.user_id === null
                    ? t('candidateProfile.profileNotLinked')
                    : t('app.messageCandidateTitle', {
                        name: candidate.name,
                      })
                }
                type="button"
              >
                <MessageIcon />
                {t('candidateProfile.messageCandidate')}
              </button>
              <span
                className={`badge-status ${scoreToneClasses[scoreTone]}`}
              >
                {t('common.score', {
                  score: candidate.score ?? t('common.notAvailable'),
                })}
              </span>
              <button
                aria-label={t('candidateProfile.closeProfile')}
                className="btn-icon"
                onClick={onClose}
                title={t('candidateProfile.closeProfile')}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section>
            <h3 className="subsection-label">
              {t('candidateProfile.contact')}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.email ? (
                <a
                  className="badge-chip py-2 text-sm"
                  href={`mailto:${candidate.email}`}
                >
                  <EnvelopeIcon />
                  {candidate.email}
                </a>
              ) : null}
              {candidate.phone ? (
                <a
                  className="badge-chip py-2 text-sm"
                  href={getPhoneHref(candidate.phone)}
                >
                  <PhoneIcon />
                  {candidate.phone}
                </a>
              ) : null}
              {linkedInUrl ? (
                <IconLink
                  href={linkedInUrl}
                  label={t('candidateProfile.openLinkedIn')}
                >
                  <LinkedInIcon />
                </IconLink>
              ) : null}
              {githubUrl ? (
                <IconLink
                  href={githubUrl}
                  label={t('candidateProfile.openGitHub')}
                >
                  <GitHubIcon />
                </IconLink>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="subsection-label">
              {t('candidateProfile.summary')}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-main)]">
              {localizedSummary ?? t('candidateProfile.noSummary')}
            </p>
          </section>

          <section>
            <h3 className="subsection-label">
              {t('candidateProfile.skills')}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.skills.length > 0 ? (
                candidate.skills.map((skill) => (
                  <button
                    className="badge-skill badge-skill-interactive"
                    key={`${candidate.id}-modal-${skill}`}
                    onClick={() => onSkillFilter(skill)}
                    type="button"
                  >
                    {skill}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted">
                  {t('candidateProfile.noSkills')}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="subsection-label">
              {t('candidateProfile.workExperience')}
            </h3>
            {candidate.experience.length > 0 ? (
              <ol className="mt-4 space-y-4 border-l border-[var(--color-border)]">
                {candidate.experience.map((experience, index) => (
                  <li
                    className="relative pl-6"
                    key={`${candidate.id}-experience-${index}`}
                  >
                    <span className="timeline-dot" />
                    <div className="card-base bg-[var(--color-surface-muted)] p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="section-title">
                            {experience.title}
                          </h4>
                          <p className="text-sm font-medium text-[var(--color-text-muted)]">
                            {experience.company}
                          </p>
                        </div>
                        <span className="badge-status badge-status-neutral text-xs">
                          {experience.duration}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                        {experience.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {t('candidateProfile.noWorkExperience')}
              </p>
            )}
          </section>

          <section>
            <h3 className="subsection-label">
              {t('candidateProfile.projects')}
            </h3>
            {candidate.projects.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {candidate.projects.map((project, index) => (
                  <article
                    className="card-base p-4"
                    key={`${candidate.id}-project-${index}`}
                  >
                    <h4 className="section-title">
                      {project.name}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                      {project.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {project.technologies.map((technology) => (
                        <span
                          className="badge-status badge-status-success px-2.5 py-1 text-xs"
                          key={`${candidate.id}-${project.name}-${technology}`}
                        >
                          {technology}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {t('candidateProfile.noProjects')}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default CandidateProfileModal
