'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { usePortal } from './portal-context'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentConfig {
  id: 'helen' | 'jasper' | 'lucia'
  name: string
  role: string
  color: string
  apiEndpoint: string
}

function AgentAvatarCircle({ agent, size, avatarUrl }: { agent: AgentConfig; size: number; avatarUrl?: string | null }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white overflow-hidden"
      style={{ width: size, height: size, backgroundColor: agent.color, fontSize: size * 0.4 }}
    >
      {avatarUrl && !imgError ? (
        <img src={avatarUrl} alt={agent.name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        agent.name[0]
      )}
    </div>
  )
}

const AGENTS: Record<string, AgentConfig> = {
  helen: { id: 'helen', name: 'Helen', role: 'Support', color: '#8b5cf6', apiEndpoint: '/api/portal/agents/helen' },
  jasper: { id: 'jasper', name: 'Jasper', role: 'Sales', color: '#3b82f6', apiEndpoint: '/api/portal/agents/jasper' },
  lucia: { id: 'lucia', name: 'Lucia', role: 'Operations', color: '#10b981', apiEndpoint: '/api/portal/agents/lucia' },
}

const suggestedQuestions: Record<string, string[]> = {
  helen: ['What\'s the status of my open tickets?', 'Can I raise a new support ticket?', 'How do I reset my Wi-Fi password?'],
  jasper: ['Can you summarise my latest quote?', 'Is my quote still valid?', 'What products are included?'],
  lucia: ['What orders do I have in progress?', 'When is my next scheduled visit?', 'What does my support contract include?'],
}

function getAgentForRoute(pathname: string): AgentConfig {
  if (pathname.includes('/helpdesk')) return AGENTS.helen
  if (pathname.includes('/orders') || pathname.includes('/visits') || pathname.includes('/contracts')) return AGENTS.lucia
  if (pathname.includes('/quotes')) return AGENTS.jasper
  return AGENTS.helen
}

export function PortalChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({})
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()
  const ctx = usePortal()

  const agent = getAgentForRoute(pathname)
  const avatarUrl = ctx.agentAvatars?.[agent.id] ?? null
  const messages = messagesByAgent[agent.id] || []

  // Load persisted sessions on mount
  useEffect(() => {
    fetch('/api/portal/chat')
      .then((res) => res.json())
      .then((saved) => {
        if (Object.keys(saved).length > 0 && !saved.error) {
          setMessagesByAgent(saved)
        }
      })
      .catch(() => {})
      .finally(() => setSessionsLoaded(true))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && textareaRef.current) textareaRef.current.focus()
  }, [isOpen])

  const handleNewChat = useCallback(async () => {
    setMessagesByAgent((prev) => ({ ...prev, [agent.id]: [] }))
    fetch('/api/portal/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear', agentId: agent.id }),
    }).catch(() => {})
  }, [agent.id])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = { role: 'user', content: trimmed }
      const updated = [...(messagesByAgent[agent.id] || []), userMessage]
      setMessagesByAgent((prev) => ({ ...prev, [agent.id]: updated }))
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch(agent.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updated }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        const assistantContent = data.message.content
        setMessagesByAgent((prev) => ({
          ...prev,
          [agent.id]: [...(prev[agent.id] || []), data.message],
        }))

        // Persist
        fetch('/api/portal/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'append', agentId: agent.id, userMessage: trimmed, assistantMessage: assistantContent }),
        }).catch(() => {})
      } catch (err) {
        setMessagesByAgent((prev) => ({
          ...prev,
          [agent.id]: [...(prev[agent.id] || []), {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          }],
        }))
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messagesByAgent, agent]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const suggested = suggestedQuestions[agent.id] || []

  if (!sessionsLoaded) return null

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105"
          style={{ backgroundColor: agent.color }}
          title={`Chat with ${agent.name}`}
        >
          {/* Pulse ring */}
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: agent.color }}
          />
          <span className="relative">
            <AgentAvatarCircle agent={agent} size={56} avatarUrl={avatarUrl} />
          </span>
        </button>
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-2 right-2 z-50 flex w-full flex-col rounded-xl bg-white shadow-2xl transition-transform duration-300 sm:w-[400px] h-[50vh] min-h-[320px] max-h-[calc(100vh-16px)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AgentAvatarCircle agent={agent} size={32} avatarUrl={avatarUrl} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{agent.name}</h2>
              <span
                className="inline-block mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
              >
                {agent.role}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={handleNewChat} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="New chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-3 pt-4">
              <p className="text-center text-xs text-slate-400">
                Hi {ctx.displayName.split(' ')[0]}! I&apos;m <strong>{agent.name}</strong>. How can I help?
              </p>
              <div className="space-y-2">
                {suggested.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="mr-2 mt-0.5">
                  <AgentAvatarCircle agent={agent} size={24} avatarUrl={avatarUrl} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white'
                    : 'text-slate-700'
                }`}
                style={
                  msg.role === 'user'
                    ? { backgroundColor: agent.color }
                    : { backgroundColor: `${agent.color}10` }
                }
              >
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-0.5">
                <AgentAvatarCircle agent={agent} size={24} avatarUrl={avatarUrl} />
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: `${agent.color}10` }}>
                <div className="flex space-x-1">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: agent.color, animationDelay: '0ms' }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: agent.color, animationDelay: '150ms' }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: agent.color, animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agent.name}...`}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 disabled:opacity-50"
              style={{ maxHeight: '80px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
              style={{ backgroundColor: agent.color }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Enter to send, Shift+Enter for new line</p>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
