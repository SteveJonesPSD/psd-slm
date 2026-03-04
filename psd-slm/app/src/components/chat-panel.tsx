'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { renderMarkdown, createMarkdownClickHandler } from '@/lib/chat-markdown'
import { loadAllChatSessions, appendChatMessages, clearChatSession } from '@/lib/chat-sessions'
import type { AgentAvatars } from '@/lib/agent-avatars'

// --- Agent Definitions ---

interface AgentConfig {
  id: string
  name: string
  role: string
  color: string
  apiEndpoint: string
}

function AgentAvatar({ agent, size, avatarUrl }: { agent: AgentConfig; size: number; avatarUrl?: string | null }) {
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
  helen: {
    id: 'helen',
    name: 'Helen',
    role: 'Service Desk Agent',
    color: '#8b5cf6',
    apiEndpoint: '/api/agents/helen',
  },
  jasper: {
    id: 'jasper',
    name: 'Jasper',
    role: 'Sales Agent',
    color: '#3b82f6',
    apiEndpoint: '/api/agents/jasper',
  },
  lucia: {
    id: 'lucia',
    name: 'Lucia',
    role: 'Administration Agent',
    color: '#10b981',
    apiEndpoint: '/api/agents/lucia',
  },
}

function getAgentForPage(pathname: string): AgentConfig {
  const segment = pathname.split('/').filter(Boolean)[0] || ''

  // Helen: helpdesk & ticketing
  if (segment === 'helpdesk') return AGENTS.helen

  // Lucia: operations, purchasing, fulfilment, scheduling
  if (
    [
      'orders',
      'purchase-orders',
      'invoices',
      'stock',
      'delivery-notes',
      'suppliers',
      'scheduling',
      'inbound-pos',
      'products',
    ].includes(segment)
  )
    return AGENTS.lucia

  // Agent pages map to themselves
  if (segment === 'agents') {
    const sub = pathname.split('/').filter(Boolean)[1] || ''
    if (sub === 'helen') return AGENTS.helen
    if (sub === 'lucia') return AGENTS.lucia
    return AGENTS.jasper
  }

  // Jasper: sales, pipeline, quotes, customers, dashboard, and everything else
  return AGENTS.jasper
}

// --- Suggested Questions per Agent ---

const suggestedQuestionsByAgent: Record<string, string[]> = {
  helen: [
    'Show me open tickets by priority',
    'Which tickets are approaching SLA breach?',
    'What is the current agent workload?',
  ],
  jasper: [
    'What does the pipeline look like?',
    'Show me recent draft quotes',
    'Which deal registrations are expiring soon?',
  ],
  lucia: [
    'Show me pending purchase orders',
    'What stock levels need attention?',
    'Are there any overdue invoices?',
  ],
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// --- Chat Panel Component ---

export function ChatPanel({ agentAvatars }: { agentAvatars?: AgentAvatars }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({})
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const agent = getAgentForPage(pathname)
  const agentAvatarUrl = agentAvatars?.[agent.id as keyof AgentAvatars] ?? null
  const messages = messagesByAgent[agent.id] || []

  const handleMarkdownClick = useMemo(() => createMarkdownClickHandler(router), [router])

  // Load persisted sessions on mount
  useEffect(() => {
    loadAllChatSessions()
      .then((saved) => {
        if (Object.keys(saved).length > 0) {
          setMessagesByAgent(saved)
        }
      })
      .catch(() => {})
      .finally(() => setSessionsLoaded(true))
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const handleNewChat = useCallback(async () => {
    setMessagesByAgent((prev) => ({ ...prev, [agent.id]: [] }))
    clearChatSession(agent.id).catch(() => {})
  }, [agent.id])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = { role: 'user', content: trimmed }
      const currentMessages = messagesByAgent[agent.id] || []
      const updatedMessages = [...currentMessages, userMessage]

      setMessagesByAgent((prev) => ({ ...prev, [agent.id]: updatedMessages }))
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch(agent.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages }),
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

        // Persist the exchange
        appendChatMessages(agent.id, trimmed, assistantContent).catch(() => {})
      } catch (err) {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        }
        setMessagesByAgent((prev) => ({
          ...prev,
          [agent.id]: [...(prev[agent.id] || []), errorMessage],
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

  const suggested = suggestedQuestionsByAgent[agent.id] || []

  return (
    <>
      {/* Toggle Button — colour-coded per agent */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl overflow-hidden"
          style={{ backgroundColor: agent.color }}
          title={`Chat with ${agent.name}`}
        >
          <AgentAvatar agent={agent} size={48} avatarUrl={agentAvatarUrl} />
        </button>
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-2 right-2 z-50 flex w-full flex-col rounded-xl bg-white shadow-2xl transition-transform duration-300 sm:w-[420px] h-[50vh] min-h-[320px] max-h-[calc(100vh-16px)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AgentAvatar agent={agent} size={32} avatarUrl={agentAvatarUrl} />
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
              <button
                onClick={handleNewChat}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="New chat"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" onClick={handleMarkdownClick}>
          {messages.length === 0 && !isLoading && (
            <div className="space-y-3 pt-4">
              <p className="text-center text-xs text-slate-400">
                Hi {user.firstName}! I&apos;m <strong>{agent.name}</strong> &mdash; your {agent.role}. How can I help?
              </p>
              <div className="space-y-2">
                {suggested.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50"
                    style={{
                      borderColor: undefined,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${agent.color}60`
                      e.currentTarget.style.backgroundColor = `${agent.color}08`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.backgroundColor = ''
                    }}
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
                  <AgentAvatar agent={agent} size={24} avatarUrl={agentAvatarUrl} />
                </div>
              )}
              <div
                className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed overflow-hidden ${
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
                {msg.role === 'assistant' ? (
                  <div
                    className="chat-markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-0.5">
                <AgentAvatar agent={agent} size={24} avatarUrl={agentAvatarUrl} />
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: `${agent.color}10` }}>
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
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:opacity-50"
              style={{
                maxHeight: '80px',
                borderColor: undefined,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = agent.color
                e.currentTarget.style.boxShadow = `0 0 0 1px ${agent.color}`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = ''
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: agent.color }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
