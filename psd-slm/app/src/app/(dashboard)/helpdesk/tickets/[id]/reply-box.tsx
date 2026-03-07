'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addMessage } from '../../actions'
import type { PresenceViewer } from '../../actions'
import { AiSuggestModal } from './ai-suggest-modal'
import type { TicketContext } from './ai-suggest-modal'

interface EmailContextInfo {
  hasEmailContext: boolean
  recipientAddress?: string
  recipientName?: string | null
  channelId?: string
}

interface ReplyBoxProps {
  ticketId: string
  ticketStatus: string
  cannedResponses: { id: string; title: string; body: string; category: string | null }[]
  ticketContext?: TicketContext
  composeRef?: React.MutableRefObject<((text: string) => void) | null>
  viewers?: PresenceViewer[]
  emailContext?: EmailContextInfo
  ticketNumber?: string
  customerName?: string
  contactName?: string | null
}

export function ReplyBox({ ticketId, ticketStatus, cannedResponses, ticketContext, composeRef, viewers, emailContext, ticketNumber, customerName, contactName }: ReplyBoxProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea when content changes (especially after AI/Helen injection)
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const minHeight = 112 // ~6 rows baseline
    const maxHeight = 320
    ta.style.height = `${Math.min(maxHeight, Math.max(minHeight, ta.scrollHeight))}px`
  }, [])

  useEffect(() => { autoResize() }, [body, autoResize])

  // Expose a compose function so parent/siblings can inject text into the reply box
  if (composeRef) {
    composeRef.current = (text: string) => {
      setBody(prev => prev ? `${prev}\n\n${text}` : text)
    }
  }
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [showAiSuggest, setShowAiSuggest] = useState(false)
  const [showPresenceConfirm, setShowPresenceConfirm] = useState(false)
  const [nudgeLoading, setNudgeLoading] = useState(false)

  const isClosed = ['closed', 'cancelled'].includes(ticketStatus)

  async function doSend() {
    setSending(true)
    try {
      const result = await addMessage(ticketId, {
        body: body.trim(),
        is_internal: isInternal,
      })
      if (!result.error) {
        setBody('')
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    if (!body.trim()) return
    // Warn if other agents are viewing this ticket (skip for internal notes)
    if (!isInternal && viewers && viewers.length > 0) {
      setShowPresenceConfirm(true)
      return
    }
    doSend()
  }

  function insertCannedResponse(responseBody: string) {
    setBody(prev => prev ? `${prev}\n\n${responseBody}` : responseBody)
    setShowCanned(false)
  }

  async function handleAiNudge() {
    if (!ticketContext) return
    setNudgeLoading(true)
    try {
      const res = await fetch('/api/helpdesk/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          ticketContext: {
            ticketNumber: ticketNumber || ticketContext.ticketNumber,
            subject: ticketContext.subject,
            customerName: customerName || ticketContext.customerName,
            contactName: contactName || ticketContext.contactName,
            messages: ticketContext.messages,
          },
        }),
      })
      const data = await res.json()
      if (data.nudge) {
        setBody(prev => prev ? `${prev}\n\n${data.nudge}` : data.nudge)
        setIsInternal(false)
      }
    } catch (err) {
      console.error('[nudge]', err)
    } finally {
      setNudgeLoading(false)
    }
  }

  if (isClosed) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-slate-400">
        This ticket is {ticketStatus}. Reopen it to add messages.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Mode toggle */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setIsInternal(false)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            !isInternal ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          Reply
        </button>
        <button
          onClick={() => setIsInternal(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            isInternal ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
          }`}
        >
          Internal Note
        </button>

        <div className="ml-auto flex items-center gap-2 relative">
          {ticketContext && (
            <>
              <button
                onClick={() => setShowAiSuggest(true)}
                className="rounded-md border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
              >
                AI Suggest
              </button>
              <button
                onClick={handleAiNudge}
                disabled={nudgeLoading}
                className="rounded-md border border-fuchsia-200 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/30 px-3 py-1.5 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 disabled:opacity-50"
              >
                {nudgeLoading ? 'Generating...' : 'AI Nudge'}
              </button>
            </>
          )}
          <button
            onClick={() => setShowCanned(!showCanned)}
            className="rounded-md border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600"
          >
            Canned Response
          </button>
          {showCanned && (
            <div className="absolute right-0 top-full mt-1 z-10 w-72 rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
              {cannedResponses.length === 0 ? (
                <div className="p-3 text-xs text-slate-400">No canned responses available</div>
              ) : (
                cannedResponses.map(cr => (
                  <button
                    key={cr.id}
                    onClick={() => insertCannedResponse(cr.body)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <div className="text-xs font-medium text-slate-700">{cr.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{cr.body.substring(0, 60)}...</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email indicator */}
      {emailContext?.hasEmailContext && !isInternal && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-400">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <span>Will be emailed to <strong>{emailContext.recipientName || emailContext.recipientAddress}</strong>
            {emailContext.recipientName && (
              <span className="font-normal text-blue-500 dark:text-blue-500"> ({emailContext.recipientAddress})</span>
            )}
          </span>
        </div>
      )}

      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={isInternal ? 'Add an internal note...' : 'Type your reply...'}
        style={{ minHeight: '112px', maxHeight: '320px' }}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none overflow-y-auto ${
          isInternal
            ? 'border-amber-200 bg-amber-50/50 focus:border-amber-400 focus:ring-amber-400'
            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
        }`}
      />

      {/* Send */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {isInternal && 'Internal notes are not visible to the customer'}
        </div>
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={sending || !body.trim()}
        >
          {sending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
        </Button>
      </div>

      {showAiSuggest && ticketContext && (
        <AiSuggestModal
          ticketContext={ticketContext}
          onClose={() => setShowAiSuggest(false)}
          onUseSuggestion={(text) => {
            setBody(prev => prev ? `${prev}\n\n${text}` : text)
            setShowAiSuggest(false)
          }}
        />
      )}

      {showPresenceConfirm && viewers && viewers.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Someone else is on this ticket</h3>
            </div>
            <p className="mb-5 text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {viewers.map(v => `${v.firstName} ${v.lastName}`).join(', ')}
              </span>
              {' '}{viewers.length === 1 ? 'is' : 'are'} currently viewing this ticket. Are you sure you want to send your reply?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPresenceConfirm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowPresenceConfirm(false)
                  doSend()
                }}
              >
                Send Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
