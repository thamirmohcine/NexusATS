import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildCandidatesCsv } from './candidateUtils'
import Auth from './components/Auth'
import ChatDrawer from './components/ChatDrawer'
import AdminDashboard from './components/candidate/AdminDashboard'
import CandidatePortal from './components/candidate/CandidatePortal'
import CandidateProfileModal from './components/candidate/CandidateProfileModal'
import PdfPreviewModal from './components/candidate/PdfPreviewModal'
import AppHeader from './components/layout/AppHeader'
import StatusBanner from './components/ui/StatusBanner'
import { useAuth } from './hooks/useAuth'
import { useCandidates } from './hooks/useCandidates'
import type { Candidate } from './types/candidate'
import type { NotificationItem } from './types/notification'

function App() {
  const { t } = useTranslation()
  const { authSession, login, logout, register } = useAuth()
  const {
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
    setCandidateSortOption,
    setSearchTerm,
    setStatusMessage,
    statusMessage,
    submitResumeText,
    uploadResumePdf,
    visibleCandidates,
  } = useCandidates(authSession)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null,
  )
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null)
  const [selectedChatCandidate, setSelectedChatCandidate] =
    useState<Candidate | null>(null)

  useEffect(() => {
    const isModalOpen =
      selectedCandidate !== null ||
      selectedPdfUrl !== null ||
      selectedChatCandidate !== null

    if (!isModalOpen) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSelectedCandidate(null)
        setSelectedPdfUrl(null)
        setSelectedChatCandidate(null)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedCandidate, selectedPdfUrl, selectedChatCandidate])

  if (authSession === null) {
    return <Auth onLogin={login} onRegister={register} />
  }

  const isAdmin = authSession.user.role === 'admin'

  const openCandidateChat = (candidate: Candidate): void => {
    setSelectedChatCandidate(candidate)
  }

  const closeDeletedCandidateViews = (candidate: Candidate): void => {
    setSelectedCandidate((currentCandidate) =>
      currentCandidate?.id === candidate.id ? null : currentCandidate,
    )
    setSelectedChatCandidate((currentCandidate) =>
      currentCandidate?.id === candidate.id ? null : currentCandidate,
    )
  }

  const handleDeleteCandidate = async (
    candidate: Candidate,
  ): Promise<void> => {
    if (await deleteCandidate(candidate)) {
      closeDeletedCandidateViews(candidate)
    }
  }

  const getChatReceiverId = (candidate: Candidate): number | null => {
    if (authSession.user.role === 'admin') {
      return candidate.user_id
    }

    return adminUsers[0]?.id ?? null
  }

  const findNotificationCandidate = (
    notification: NotificationItem,
    candidateList: Candidate[],
  ): Candidate | null => {
    if (notification.candidate_id === null) {
      return null
    }

    if (candidateProfile?.id === notification.candidate_id) {
      return candidateProfile
    }

    return (
      candidateList.find(
        (candidate) => candidate.id === notification.candidate_id,
      ) ?? null
    )
  }

  const handleNotificationClick = async (
    notification: NotificationItem,
  ): Promise<void> => {
    if (notification.type !== 'message') {
      return
    }

    const existingCandidate = findNotificationCandidate(
      notification,
      candidates,
    )

    if (existingCandidate !== null) {
      setSelectedCandidate(null)
      setSelectedPdfUrl(null)
      openCandidateChat(existingCandidate)
      return
    }

    try {
      const loadedCandidates = await refreshCandidates()
      const resolvedCandidate = findNotificationCandidate(
        notification,
        loadedCandidates,
      )

      if (resolvedCandidate === null) {
        setStatusMessage({
          type: 'error',
          text: t('status.unableOpenChat'),
        })
        return
      }

      setSelectedCandidate(null)
      setSelectedPdfUrl(null)
      openCandidateChat(resolvedCandidate)
    } catch {
      setStatusMessage({
        type: 'error',
        text: t('status.unableOpenChat'),
      })
    }
  }

  const handleExportCandidates = (): void => {
    if (visibleCandidates.length === 0) {
      return
    }

    const csvContent = buildCandidatesCsv(visibleCandidates)
    const csvBlob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8',
    })
    const downloadUrl = URL.createObjectURL(csvBlob)
    const downloadLink = document.createElement('a')

    downloadLink.href = downloadUrl
    downloadLink.download = `candidates-export-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    document.body.append(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    URL.revokeObjectURL(downloadUrl)
  }

  const handleLogout = (): void => {
    logout()
    clearCandidateState()
    setSelectedCandidate(null)
    setSelectedPdfUrl(null)
    setSelectedChatCandidate(null)
  }

  return (
    <main className="app-shell">
      <AppHeader
        authToken={authSession.token}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onNotificationClick={(notification) => {
          void handleNotificationClick(notification)
        }}
        user={authSession.user}
      />

      <div
        className={`mx-auto grid gap-6 px-6 py-8 ${
          isAdmin
            ? 'max-w-7xl'
            : 'max-w-5xl lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]'
        }`}
      >
        {statusMessage ? (
          <StatusBanner statusMessage={statusMessage} />
        ) : null}

        {isAdmin ? (
          <AdminDashboard
            candidateSortOption={candidateSortOption}
            candidatesCount={candidates.length}
            isDeletingCandidateId={isDeletingCandidateId}
            isLoadingCandidates={isLoadingCandidates}
            onDeleteCandidate={(candidate) => {
              void handleDeleteCandidate(candidate)
            }}
            onExportCandidates={handleExportCandidates}
            onOpenChat={openCandidateChat}
            onOpenProfile={setSelectedCandidate}
            onPreviewPdf={setSelectedPdfUrl}
            onSearchTermChange={setSearchTerm}
            onSkillFilter={setSearchTerm}
            onSortOptionChange={setCandidateSortOption}
            searchTerm={searchTerm}
            visibleCandidates={visibleCandidates}
          />
        ) : (
          <CandidatePortal
            candidate={candidateProfile}
            isAnalyzing={isAnalyzing}
            isDeleting={
              candidateProfile !== null &&
              isDeletingCandidateId === candidateProfile.id
            }
            isUploadingPdf={isUploadingPdf}
            onAnalyzeResume={submitResumeText}
            onDeleteCandidate={(candidate) => {
              void handleDeleteCandidate(candidate)
            }}
            onOpenChat={openCandidateChat}
            onUploadPdf={uploadResumePdf}
          />
        )}
      </div>

      {selectedCandidate ? (
        <CandidateProfileModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onOpenChat={(candidate) => {
            setSelectedCandidate(null)
            openCandidateChat(candidate)
          }}
          onSkillFilter={(skill) => {
            setSearchTerm(skill)
            setSelectedCandidate(null)
          }}
        />
      ) : null}

      {selectedPdfUrl ? (
        <PdfPreviewModal
          onClose={() => setSelectedPdfUrl(null)}
          pdfUrl={selectedPdfUrl}
        />
      ) : null}

      {selectedChatCandidate ? (
        <ChatDrawer
          authToken={authSession.token}
          candidateId={selectedChatCandidate.id}
          currentUserId={authSession.user.id}
          isOpen={selectedChatCandidate !== null}
          onClose={() => setSelectedChatCandidate(null)}
          otherUserLabel={isAdmin ? selectedChatCandidate.name : t('chat.admin')}
          receiverId={getChatReceiverId(selectedChatCandidate)}
          subtitle={
            isAdmin
              ? selectedChatCandidate.email ?? t('app.candidateConversation')
              : selectedChatCandidate.name
          }
          title={
            isAdmin
              ? t('app.messageCandidateTitle', {
                  name: selectedChatCandidate.name,
                })
              : t('app.contactAdminTitle')
          }
        />
      ) : null}
    </main>
  )
}

export default App
