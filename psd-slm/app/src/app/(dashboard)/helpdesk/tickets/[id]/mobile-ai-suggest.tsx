'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TicketContext } from './ai-suggest-modal'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  hasSuggestion?: boolean
  suggestedResponse?: string | null
}

interface MobileAiSuggestProps {
  ticketContext: TicketContext
  onClose: () => void
  onUseSuggestion: (text: string) => void
}

export function MobileAiSuggest({ ticketContext, onClose, onUseSuggestion }: MobileAiSuggestProps) {
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

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    sendMessages(updated)
  }

  function getDisplayContent(msg: ChatMessage): string {
    return msg.content
      .replace(/\[SUGGESTED RESPONSE\][\s\S]*?\[\/SUGGESTED RESPONSE\]/g, '')
      .trim()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Suggest</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap">{getDisplayContent(msg)}</div>
              </div>
            </div>

            {msg.hasSuggestion && msg.suggestedResponse && (
              <div className="mt-2 mx-1 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Suggested Response</span>
                </div>
                <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{msg.suggestedResponse}</div>
                <button
                  onClick={() => onUseSuggestion(msg.suggestedResponse!)}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white active:bg-emerald-700"
                >
                  Use This Response
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 flex items-center gap-2 border-t border-gray-200 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 safe-area-inset-bottom">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          disabled={loading}
          placeholder="Refine the suggestion..."
          className="flex-1 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 dark:disabled:bg-slate-800 disabled:text-slate-400"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-50 active:bg-indigo-700 shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
