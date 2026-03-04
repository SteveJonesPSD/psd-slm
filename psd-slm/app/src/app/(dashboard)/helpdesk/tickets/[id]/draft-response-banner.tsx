'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveDraftResponse, rejectDraftResponse } from '../../actions'
import type { HelenDraftType } from '@/types/database'

interface DraftResponse {
  id: string
  draft_type: HelenDraftType
  body: string
  ai_reasoning: string | null
  status: string
}

interface DraftResponseBannerProps {
  drafts: DraftResponse[]
  ticketId: string
}

export function DraftResponseBanner({ drafts, ticketId }: DraftResponseBannerProps) {
  const router = useRouter()
  const pendingDrafts = drafts.filter((d) => d.status === 'pending')

  if (pendingDrafts.length === 0) return null

  return (
    <div className="space-y-3">
      {pendingDrafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} ticketId={ticketId} onAction={() => router.refresh()} />
      ))}
    </div>
  )
}

function DraftCard({ draft, ticketId, onAction }: { draft: DraftResponse; ticketId: string; onAction: () => void }) {
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(draft.body)
  const [showReasoning, setShowReasoning] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async (body?: string) => {
    setLoading(true)
    const result = await approveDraftResponse(draft.id, ticketId, body)
    if (result.error) {
      console.error(result.error)
    }
    setLoading(false)
    onAction()
  }

  const handleReject = async () => {
    setLoading(true)
    const result = await rejectDraftResponse(draft.id, ticketId)
    if (result.error) {
      console.error(result.error)
    }
    setLoading(false)
    onAction()
  }

  const draftTypeLabel = draft.draft_type === 'needs_detail' ? 'Needs Detail' : 'Triage Response'

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
          AI
        </div>
        <span className="text-sm font-semibold text-violet-900">Helen AI</span>
        <span className="rounded bg-violet-200/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
          {draftTypeLabel}
        </span>
        <span className="text-[10px] text-violet-400">Draft — awaiting approval</span>
      </div>

      {editing ? (
        <textarea
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
          className="w-full rounded-lg border border-violet-200 bg-white p-3 text-sm text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
          rows={6}
        />
      ) : (
        <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-700 whitespace-pre-wrap">
          {draft.body}
        </div>
      )}

      {/* AI Reasoning (collapsible) */}
      {draft.ai_reasoning && (
        <div className="mt-2">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-[10px] font-medium text-violet-500 hover:text-violet-700"
          >
            {showReasoning ? 'Hide reasoning' : 'Show AI reasoning'}
          </button>
          {showReasoning && (
            <div className="mt-1 rounded-lg bg-violet-100/50 p-2 text-xs text-violet-700 italic">
              {draft.ai_reasoning}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={() => handleApprove(editedBody)}
              disabled={loading || !editedBody.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Edited Response'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditedBody(draft.body) }}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel Edit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              disabled={loading}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
            >
              Edit & Approve
            </button>
            <button
              onClick={() => handleApprove()}
              disabled={loading}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Approve As-Is'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}
