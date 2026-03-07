'use client'

import { useState, useRef, useEffect, useCallback, useMemo, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { renderMarkdown, createMarkdownClickHandler } from '@/lib/chat-markdown'
import { loadChatSession, appendChatMessages, clearChatSession } from '@/lib/chat-sessions'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AgentChatProps {
  agentId: string
  agentName: string
  agentRole: string
  agentColor: string
  apiEndpoint: string
  userName: string
  agentAvatarUrl?: string | null
}

function AgentAvatarCircle({ name, color, url, size }: { name: string; color: string; url?: string | null; size: number }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white overflow-hidden"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {url && !imgError ? (
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        name[0]
      )}
    </div>
  )
}

export function AgentChat({ agentId, agentName, agentRole, agentColor, apiEndpoint, userName, agentAvatarUrl }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const handleMarkdownClick = useMemo(() => createMarkdownClickHandler(router), [router])

  // Load persisted session on mount
  useEffect(() => {
    loadChatSession(agentId)
      .then((session) => {
        if (session && session.messages.length > 0) {
          setMessages(session.messages)
        }
      })
      .catch(() => {})
      .finally(() => setSessionLoaded(true))
  }, [agentId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (sessionLoaded) inputRef.current?.focus()
  }, [sessionLoaded])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setError(null)
    clearChatSession(agentId).catch(() => {})
    inputRef.current?.focus()
  }, [agentId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      const data = await res.json()
      setMessages((prev) => [...prev, data.message])

      // Persist the exchange
      appendChatMessages(agentId, text, data.message.content).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] max-h-[calc(100vh-160px)] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Top bar with New Chat */}
      {messages.length > 0 && (
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            New chat
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" onClick={handleMarkdownClick}>
        {/* Welcome card */}
        {messages.length === 0 && !loading && (
          <div className="flex items-start gap-2.5 sm:gap-3 max-w-full sm:max-w-2xl">
            <AgentAvatarCircle name={agentName} color={agentColor} url={agentAvatarUrl} size={28} />
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700"
              style={{ backgroundColor: `${agentColor}10` }}
            >
              <p>
                Hi {userName}, I&apos;m <strong>{agentName}</strong> &mdash; your {agentRole}.
                How can I help?
              </p>
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <AgentAvatarCircle name={agentName} color={agentColor} url={agentAvatarUrl} size={28} />
            )}
            <div
              className={`max-w-[85%] sm:max-w-2xl rounded-2xl px-3 sm:px-4 py-3 text-sm overflow-hidden ${
                msg.role === 'user'
                  ? 'rounded-tr-sm bg-slate-100 text-slate-800 whitespace-pre-wrap'
                  : 'rounded-tl-sm text-slate-700'
              }`}
              style={msg.role === 'assistant' ? { backgroundColor: `${agentColor}10` } : undefined}
            >
              {msg.role === 'assistant' ? (
                <div
                  className="chat-markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-2.5 sm:gap-3">
            <AgentAvatarCircle name={agentName} color={agentColor} url={agentAvatarUrl} size={28} />
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-500"
              style={{ backgroundColor: `${agentColor}10` }}
            >
              Thinking...
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex justify-center">
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: agentColor }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
