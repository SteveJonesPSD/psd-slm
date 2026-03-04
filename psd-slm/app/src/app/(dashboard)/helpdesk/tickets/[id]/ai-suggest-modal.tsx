'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'

export interface TicketContext {
  ticketNumber: string
  subject: string
  description: string | null
  customerName: string
  contactName: string | null
  status: string
  priority: string
  ticketType: string
  category: string | null
  slaResponseDue: string | null
  slaResolutionDue: string | null
  assigneeName: string | null
  messages: {
    senderType: 'agent' | 'customer' | 'system'
    senderName: string | null
    body: string
    isInternal: boolean
    createdAt: string
  }[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  hasSuggestion?: boolean
  suggestedResponse?: string | null
}

interface AiSuggestModalProps {
  ticketContext: TicketContext
  onClose: () => void
  onUseSuggestion: (text: string) => void
}

export function AiSuggestModal({ ticketContext, onClose, onUseSuggestion }: AiSuggestModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSentInitial = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const sendMessages = useCallback(async (allMessages: ChatMessage[]) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/helpdesk/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketContext,
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to get suggestion')
      }

      const data = await res.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message.content,
        hasSuggestion: data.message.hasSuggestion,
        suggestedResponse: data.message.suggestedResponse,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [ticketContext])

  // Auto-send initial prompt on mount
  useEffect(() => {
    if (hasSentInitial.current) return
    hasSentInitial.current = true

    const initialMessage: ChatMessage = {
      role: 'user',
      content: 'Please review this ticket and suggest a customer response.',
    }
    setMessages([initialMessage])
    sendMessages([initialMessage])
  }, [sendMessages])

  // Auto-scroll on new messages or loading change
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Focus input when not loading
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [loading])

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    sendMessages(updated)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Strip [SUGGESTED RESPONSE] delimiters from display text
  function getDisplayContent(msg: ChatMessage): string {
    return msg.content
      .replace(/\[SUGGESTED RESPONSE\][\s\S]*?\[\/SUGGESTED RESPONSE\]/g, '')
      .trim()
  }

  return (
    <Modal title="AI Suggest Response" onClose={onClose} width={640}>
      <div className="flex flex-col" style={{ height: '60vh' }}>
        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-3">
          {messages.map((msg, i) => (
            <div key={i}>
              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-slate-700'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{getDisplayContent(msg)}</div>
                </div>
              </div>

              {/* Suggestion card */}
              {msg.hasSuggestion && msg.suggestedResponse && (
                <div className="mt-2 ml-0 mr-8 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">Suggested Response</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700">{msg.suggestedResponse}</div>
                  <button
                    onClick={() => onUseSuggestion(msg.suggestedResponse!)}
                    className="mt-3 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Use This Response
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-slate-400">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask Claude to refine the suggestion..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </Modal>
  )
}
