'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import type { ChatMessage, PageContext } from '@/lib/ai/types'

// --- Lightweight Markdown Renderer ---

function renderMarkdown(text: string): string {
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Tables: detect lines with | separators
  html = html.replace(
    /(?:^|\n)((?:\|.+\|(?:\n|$))+)/g,
    (_, tableBlock: string) => {
      const rows = tableBlock.trim().split('\n')
      if (rows.length < 2) return tableBlock

      // Check if second row is separator
      const isSeparator = /^\|[\s\-:|]+\|$/.test(rows[1])
      const dataRows = isSeparator ? [rows[0], ...rows.slice(2)] : rows

      const renderRow = (row: string, isHeader: boolean) => {
        const cells = row.split('|').slice(1, -1).map((c) => c.trim())
        const tag = isHeader ? 'th' : 'td'
        const cls = isHeader
          ? 'px-2 py-1 text-left text-xs font-semibold text-slate-600 border-b border-slate-200'
          : 'px-2 py-1 text-xs text-slate-700 border-b border-slate-100'
        return `<tr>${cells.map((c) => `<${tag} class="${cls}">${c}</${tag}>`).join('')}</tr>`
      }

      let tableHtml = '<table class="w-full text-left my-1 border-collapse">'
      if (isSeparator) {
        tableHtml += `<thead>${renderRow(dataRows[0], true)}</thead>`
        tableHtml += '<tbody>'
        for (let i = 1; i < dataRows.length; i++) {
          tableHtml += renderRow(dataRows[i], false)
        }
        tableHtml += '</tbody>'
      } else {
        tableHtml += '<tbody>'
        for (const row of dataRows) {
          tableHtml += renderRow(row, false)
        }
        tableHtml += '</tbody>'
      }
      tableHtml += '</table>'
      return '\n' + tableHtml
    }
  )

  // Code blocks (```)
  html = html.replace(
    /```(?:\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-slate-800 text-slate-100 text-xs rounded p-2 my-1 overflow-x-auto whitespace-pre-wrap">$1</pre>'
  )

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-slate-200 text-slate-800 text-xs rounded px-1">$1</code>'
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Bullet lists
  html = html.replace(
    /(?:^|\n)((?:[-*] .+(?:\n|$))+)/g,
    (_, block: string) => {
      const items = block
        .trim()
        .split('\n')
        .map((l: string) => `<li class="ml-4 list-disc">${l.replace(/^[-*] /, '')}</li>`)
        .join('')
      return `\n<ul class="my-1 space-y-0.5">${items}</ul>`
    }
  )

  // Numbered lists
  html = html.replace(
    /(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g,
    (_, block: string) => {
      const items = block
        .trim()
        .split('\n')
        .map((l: string) => `<li class="ml-4 list-decimal">${l.replace(/^\d+\. /, '')}</li>`)
        .join('')
      return `\n<ol class="my-1 space-y-0.5">${items}</ol>`
    }
  )

  // Paragraphs (double newlines)
  html = html
    .split(/\n{2,}/)
    .map((p) => {
      const trimmed = p.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return trimmed
      return `<p class="my-1">${trimmed}</p>`
    })
    .join('')

  // Single newlines within paragraphs to <br>
  html = html.replace(/([^>])\n([^<])/g, '$1<br/>$2')

  return html
}

// --- Page Context Detection ---

function getPageContext(pathname: string): PageContext {
  const segments = pathname.split('/').filter(Boolean)
  let module = 'Dashboard'
  let entityId: string | undefined

  if (segments.length >= 1) {
    const moduleMap: Record<string, string> = {
      dashboard: 'Dashboard',
      customers: 'Customers',
      contacts: 'Contacts',
      pipeline: 'Pipeline',
      quotes: 'Quotes',
      products: 'Products',
      suppliers: 'Suppliers',
      'deal-registrations': 'Deal Registrations',
      'sales-orders': 'Sales Orders',
      'purchase-orders': 'Purchase Orders',
      invoices: 'Invoices',
      commission: 'Commission',
      team: 'Team',
      settings: 'Settings',
    }
    module = moduleMap[segments[0]] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
  }

  // UUID pattern for entity detail pages
  if (segments.length >= 2 && /^[0-9a-f-]{36}$/.test(segments[1])) {
    entityId = segments[1]
  }

  return { pathname, module, entityId }
}

// --- Suggested Questions ---

const suggestedQuestionsByModule: Record<string, string[]> = {
  Dashboard: [
    'What does the pipeline look like?',
    'How many active customers do we have?',
    'Show me the team summary',
  ],
  Customers: [
    'How many customers do we have?',
    'Search for customers in London',
    'Which customers have active deal registrations?',
  ],
  Pipeline: [
    'Summarise the pipeline by stage',
    'Which opportunities are in negotiation?',
    'What is the total pipeline value?',
  ],
  Quotes: [
    'Show me recent draft quotes',
    'What quotes are pending review?',
    'Which quotes expire this month?',
  ],
  Products: [
    'Search for a product by name',
    'How many active products do we have?',
    'Which products are stocked?',
  ],
  'Deal Registrations': [
    'Show active deal registrations',
    'Any deal regs expiring soon?',
    'Check deal pricing for a customer',
  ],
  Team: [
    'Show me the team summary',
    'Who has the most opportunities?',
    'Which sales rep has the most quotes?',
  ],
}

function getSuggestedQuestions(module: string): string[] {
  return suggestedQuestionsByModule[module] || suggestedQuestionsByModule.Dashboard
}

// --- Chat Panel Component ---

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()
  const { user } = useAuth()

  const pageContext = getPageContext(pathname)

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            pageContext,
          }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
      } catch (err) {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages, pageContext]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const suggested = getSuggestedQuestions(pageContext.module)

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
          title="Open SLM Assistant"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 sm:w-[420px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">SLM Assistant</h2>
            <span className="inline-block mt-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
              {pageContext.module}
              {pageContext.entityId ? ' Detail' : ''}
            </span>
          </div>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-3 pt-4">
              <p className="text-center text-xs text-slate-400">
                Hi {user.firstName}! Ask me anything about your SLM data.
              </p>
              <div className="space-y-2">
                {suggested.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      sendMessage(q)
                    }}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
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
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <div className="flex space-x-1">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
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
              placeholder="Ask about your data..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
              style={{ maxHeight: '80px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition-colors hover:bg-indigo-600 disabled:opacity-40"
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
