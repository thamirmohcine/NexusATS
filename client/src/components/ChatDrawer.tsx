import {
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useChat } from '../hooks/useChat'

interface ChatDrawerProps {
  authToken: string
  candidateId: number
  currentUserId: number
  isOpen: boolean
  onClose: () => void
  receiverId: number | null
  subtitle?: string
  title: string
  otherUserLabel: string
}

const formatMessageTime = (
  createdAt: string,
  locale: string,
  fallback: string,
): string => {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function MessageReadStatus({ isRead }: { isRead: 0 | 1 }) {
  const { t } = useTranslation()
  const isSeen = isRead === 1

  return (
    <div
      className={`message-read-status ${
        isSeen ? 'message-read-status-seen' : 'message-read-status-sent'
      }`}
    >
      <span aria-hidden="true">{isSeen ? '✓✓' : '✓'}</span>
      <span>{isSeen ? t('chat.seen') : t('chat.sent')}</span>
    </div>
  )
}

function ChatDrawer({
  authToken,
  candidateId,
  currentUserId,
  isOpen,
  onClose,
  receiverId,
  subtitle,
  title,
  otherUserLabel,
}: ChatDrawerProps) {
  const { i18n, t } = useTranslation()
  const timeLocale = i18n.resolvedLanguage ?? i18n.language
  const {
    canSend,
    errorMessage,
    isLoading,
    isSending,
    messageText,
    messages,
    messagesEndRef,
    sendCurrentMessage,
    setMessageText,
  } = useChat({
    authToken,
    candidateId,
    isOpen,
    receiverId,
  })

  if (!isOpen) {
    return null
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    await sendCurrentMessage()
  }

  return (
    <div
      aria-labelledby="chat-drawer-title"
      aria-modal="true"
      className="drawer-backdrop"
      onMouseDown={onClose}
      role="dialog"
    >
      <aside
        className="drawer-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="card-header px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="section-eyebrow">
                {t('chat.liveChat')}
              </p>
              <h2
                className="section-title mt-1 truncate text-xl"
                id="chat-drawer-title"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 truncate text-sm text-muted">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              aria-label={t('chat.close')}
              className="btn-icon"
              onClick={onClose}
              title={t('chat.close')}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--color-background)] px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  className="h-16 animate-pulse rounded-lg bg-[var(--color-surface)]"
                  key={item}
                />
              ))}
            </div>
          ) : null}

          {!isLoading && messages.length === 0 ? (
            <div className="empty-state px-4 py-8">
              <p className="section-title text-sm">
                {t('chat.noMessages')}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('chat.startConversation')}
              </p>
            </div>
          ) : null}

          {!isLoading && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((message) => {
                const isMine = message.sender_id === currentUserId
                const senderLabel = isMine ? t('chat.you') : otherUserLabel

                return (
                  <div
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    key={message.id}
                  >
                    <div
                      className={`chat-bubble ${
                        isMine ? 'chat-bubble-mine' : 'chat-bubble-other'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span
                          className={
                            isMine
                              ? 'text-[var(--color-border)]'
                              : 'text-muted'
                          }
                        >
                          {senderLabel}
                        </span>
                        <span className="text-[var(--color-text-subtle)]">
                          {formatMessageTime(
                            message.created_at,
                            timeLocale,
                            t('common.justNow'),
                          )}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </p>
                      {isMine ? (
                        <MessageReadStatus isRead={message.is_read} />
                      ) : null}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : null}
        </div>

        <footer className="card-header border-b-0 border-t p-4">
          {receiverId === null ? (
            <p className="status-alert status-alert-warning mb-3 px-3 py-2">
              {t('chat.recipientUnavailable')}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="status-alert status-alert-error mb-3 px-3 py-2">
              {errorMessage}
            </p>
          ) : null}

          <form className="flex gap-2" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chatMessage">
              {t('chat.messageLabel')}
            </label>
            <input
              className="input-field min-w-0 flex-1 disabled:bg-[var(--color-surface-muted)]"
              disabled={receiverId === null || isSending}
              id="chatMessage"
              onChange={(event) => setMessageText(event.target.value)}
              placeholder={t('chat.placeholder')}
              value={messageText}
            />
            <button
              className="btn-primary"
              disabled={!canSend}
              type="submit"
            >
              <SendIcon />
              {isSending ? t('chat.sending') : t('chat.send')}
            </button>
          </form>
        </footer>
      </aside>
    </div>
  )
}

export default ChatDrawer
