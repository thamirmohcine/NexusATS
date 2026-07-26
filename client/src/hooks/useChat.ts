import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { getMessages, sendMessage } from '../services/chatService'
import type { ChatMessage } from '../types/chat'

interface UseChatOptions {
  authToken: string
  candidateId: number
  isOpen: boolean
  receiverId: number | null
}

export interface UseChatResult {
  canSend: boolean
  errorMessage: string | null
  isLoading: boolean
  isSending: boolean
  messageText: string
  messages: ChatMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
  sendCurrentMessage: () => Promise<void>
  setMessageText: Dispatch<SetStateAction<string>>
}

export function useChat({
  authToken,
  candidateId,
  isOpen,
  receiverId,
}: UseChatOptions): UseChatResult {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const loadMessages = useCallback(
    async (showLoadingState: boolean): Promise<void> => {
      if (!isOpen) {
        return
      }

      if (showLoadingState) {
        setIsLoading(true)
      }

      try {
        const loadedMessages = await getMessages(candidateId, authToken)
        setMessages(loadedMessages)
        setErrorMessage(null)
      } catch {
        setErrorMessage(t('chat.errors.load'))
      } finally {
        if (showLoadingState) {
          setIsLoading(false)
        }
      }
    },
    [authToken, candidateId, isOpen, t],
  )

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const initialLoadId = window.setTimeout(() => {
      void loadMessages(true)
    }, 0)

    const pollingId = window.setInterval(() => {
      void loadMessages(false)
    }, 3000)

    return () => {
      window.clearTimeout(initialLoadId)
      window.clearInterval(pollingId)
    }
  }, [isOpen, loadMessages])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [isOpen, messages])

  const trimmedMessageText = messageText.trim()
  const canSend =
    receiverId !== null && trimmedMessageText.length > 0 && !isSending

  const sendCurrentMessage = async (): Promise<void> => {
    if (receiverId === null) {
      setErrorMessage(t('chat.recipientUnavailable'))
      return
    }

    if (trimmedMessageText.length === 0) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const savedMessage = await sendMessage(
        {
          candidate_id: candidateId,
          content: trimmedMessageText,
          receiver_id: receiverId,
        },
        authToken,
      )

      setMessages((currentMessages) => [
        ...currentMessages.filter((message) => message.id !== savedMessage.id),
        savedMessage,
      ])
      setMessageText('')
      void loadMessages(false)
    } catch {
      setErrorMessage(t('chat.errors.send'))
    } finally {
      setIsSending(false)
    }
  }

  return {
    canSend,
    errorMessage,
    isLoading,
    isSending,
    messageText,
    messages,
    messagesEndRef,
    sendCurrentMessage,
    setMessageText,
  }
}
