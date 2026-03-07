'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { addMessage } from '../../actions'
import { MobileAiSuggest } from './mobile-ai-suggest'
import type { TicketContext } from './ai-suggest-modal'

interface MobileReplySheetProps {
  open: boolean
  onClose: () => void
  ticketId: string
  ticketStatus: string
  initialMode: 'reply' | 'note'
  cannedResponses: { id: string; title: string; body: string; category: string | null }[]
  ticketContext?: TicketContext
  initialBody?: string
  ticketNumber?: string
  customerName?: string
  contactName?: string | null
}

export function MobileReplySheet({
  open,
  onClose,
  ticketId,
  ticketStatus,
  initialMode,
  cannedResponses,
  ticketContext,
  initialBody,
  ticketNumber,
  customerName,
  contactName,
}: MobileReplySheetProps) {
  const router = useRouter()
  const [body, setBody] = useState(initialBody || '')
  const [isInternal, setIsInternal] = useState(initialMode === 'note')
  const [sending, setSending] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [showAiSuggest, setShowAiSuggest] = useState(false)
  const [cannedSearch, setCannedSearch] = useState('')
  const [nudgeLoading, setNudgeLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-populate body from initialBody (e.g. compose-from-assist)
  useEffect(() => {
    if (initialBody) {
      setBody(initialBody)
      // Focus and scroll to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.selectionStart = textareaRef.current.value.length
        }
      }, 100)
    }
  }, [initialBody])

  const isClosed = ['closed', 'cancelled'].includes(ticketStatus)

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    try {
      const result = await addMessage(ticketId, {
        body: body.trim(),
        is_internal: isInternal,
      })
      if (!result.error) {
        setBody('')
        onClose()
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  function insertCannedResponse(responseBody: string) {
    setBody(prev => prev ? `${prev}\n\n${responseBody}` : responseBody)
    setShowCanned(false)
    setCannedSearch('')
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

  const filteredCanned = cannedSearch
    ? cannedResponses.filter(cr =>
        cr.title.toLowerCase().includes(cannedSearch.toLowerCase()) ||
        cr.body.toLowerCase().includes(cannedSearch.toLowerCase())
      )
    : cannedResponses

  return (
    <BottomSheet open={open} onClose={onClose} title={isInternal ? 'Internal Note' : 'Reply'} fullScreen>
      {isClosed ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          This ticket is {ticketStatus}. Reopen it to add messages.
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-80px)]">
          {/* Mode toggle */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setIsInternal(false)}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                !isInternal
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}
            >
              Reply
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                isInternal
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              }`}
            >
              Internal Note
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            autoFocus={!initialBody}
            placeholder={isInternal ? 'Add an internal note...' : 'Type your reply...'}
            className={`w-full flex-1 rounded-xl border px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 resize-none dark:bg-slate-800 dark:text-slate-200 ${
              isInternal
                ? 'border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 focus:ring-amber-400'
                : 'border-gray-200 dark:border-slate-600 focus:ring-indigo-500'
            }`}
          />

          {/* Tool buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {ticketContext && (
              <>
                <button
                  onClick={() => setShowAiSuggest(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 px-3 py-2.5 text-xs font-medium text-purple-700 dark:text-purple-300 active:bg-purple-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  AI Suggest
                </button>
                <button
                  onClick={handleAiNudge}
                  disabled={nudgeLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-fuchsia-200 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/30 px-3 py-2.5 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300 active:bg-fuchsia-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  {nudgeLoading ? 'Generating...' : 'AI Nudge'}
                </button>
              </>
            )}
            <button
              onClick={() => setShowCanned(!showCanned)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                showCanned
                  ? 'border-gray-300 bg-gray-100 text-slate-700 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-200'
                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Canned
            </button>
          </div>

          {/* Canned responses list */}
          {showCanned && (
            <div className="mt-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
              {/* Search within canned */}
              <div className="border-b border-gray-100 dark:border-slate-700 px-3 py-2">
                <input
                  type="text"
                  value={cannedSearch}
                  onChange={e => setCannedSearch(e.target.value)}
                  placeholder="Search responses..."
                  className="w-full text-xs bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCanned.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400">No responses found</div>
                ) : (
                  filteredCanned.map(cr => (
                    <button
                      key={cr.id}
                      onClick={() => insertCannedResponse(cr.body)}
                      className="w-full text-left px-3 py-3 border-b border-gray-50 dark:border-slate-700 last:border-0 active:bg-gray-50 dark:active:bg-slate-700"
                    >
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{cr.title}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{cr.body.substring(0, 80)}{cr.body.length > 80 ? '...' : ''}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Helper text */}
          {isInternal && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Internal notes are not visible to the customer
            </div>
          )}

          {/* Send button */}
          <div className="mt-4 safe-area-inset-bottom">
            <button
              onClick={handleSend}
              disabled={sending || !body.trim()}
              className={`w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-transform ${
                isInternal
                  ? 'bg-amber-600 active:bg-amber-700'
                  : 'bg-indigo-600 active:bg-indigo-700'
              }`}
            >
              {sending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
            </button>
          </div>
        </div>
      )}

      {showAiSuggest && ticketContext && (
        <MobileAiSuggest
          ticketContext={ticketContext}
          onClose={() => setShowAiSuggest(false)}
          onUseSuggestion={(text) => {
            setBody(prev => prev ? `${prev}\n\n${text}` : text)
            setShowAiSuggest(false)
          }}
        />
      )}
    </BottomSheet>
  )
}
