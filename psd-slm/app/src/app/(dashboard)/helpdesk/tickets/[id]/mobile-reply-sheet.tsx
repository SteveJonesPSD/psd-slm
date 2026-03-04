'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { addMessage } from '../../actions'
import { AiSuggestModal } from './ai-suggest-modal'
import type { TicketContext } from './ai-suggest-modal'

interface MobileReplySheetProps {
  open: boolean
  onClose: () => void
  ticketId: string
  ticketStatus: string
  initialMode: 'reply' | 'note'
  cannedResponses: { id: string; title: string; body: string; category: string | null }[]
  ticketContext?: TicketContext
}

export function MobileReplySheet({
  open,
  onClose,
  ticketId,
  ticketStatus,
  initialMode,
  cannedResponses,
  ticketContext,
}: MobileReplySheetProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(initialMode === 'note')
  const [sending, setSending] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [showAiSuggest, setShowAiSuggest] = useState(false)

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
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isInternal ? 'Internal Note' : 'Reply'} fullScreen>
      {isClosed ? (
        <div className="py-12 text-center text-sm text-slate-400">
          This ticket is {ticketStatus}. Reopen it to add messages.
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-80px)]">
          {/* Mode toggle */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setIsInternal(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                !isInternal ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              Reply
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isInternal ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              Internal Note
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            autoFocus
            placeholder={isInternal ? 'Add an internal note...' : 'Type your reply...'}
            className={`w-full flex-1 rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 resize-none ${
              isInternal
                ? 'border-amber-200 bg-amber-50/50 focus:border-amber-400 focus:ring-amber-400'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
          />

          {/* Tool buttons */}
          <div className="mt-3 flex gap-2">
            {ticketContext && (
              <button
                onClick={() => setShowAiSuggest(true)}
                className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700"
              >
                AI Suggest
              </button>
            )}
            <button
              onClick={() => setShowCanned(!showCanned)}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs text-slate-500"
            >
              Canned Response
            </button>
          </div>

          {/* Canned responses list */}
          {showCanned && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {cannedResponses.length === 0 ? (
                <div className="p-3 text-xs text-slate-400">No canned responses available</div>
              ) : (
                cannedResponses.map(cr => (
                  <button
                    key={cr.id}
                    onClick={() => insertCannedResponse(cr.body)}
                    className="w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 active:bg-gray-50"
                  >
                    <div className="text-xs font-medium text-slate-700">{cr.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{cr.body.substring(0, 60)}...</div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Helper text */}
          {isInternal && (
            <div className="mt-2 text-xs text-slate-400">Internal notes are not visible to the customer</div>
          )}

          {/* Send button */}
          <div className="mt-4">
            <button
              onClick={handleSend}
              disabled={sending || !body.trim()}
              className={`w-full rounded-lg px-4 py-3 text-sm font-medium text-white disabled:opacity-50 ${
                isInternal
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {sending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
            </button>
          </div>
        </div>
      )}

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
    </BottomSheet>
  )
}
