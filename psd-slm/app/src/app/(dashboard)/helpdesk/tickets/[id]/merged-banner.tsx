'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { unmergeTicket } from '../../actions'

interface MergedBannerProps {
  targetTicketId: string
  targetTicketNumber: string
  mergeId: string | null
}

export function MergedBanner({ targetTicketId, targetTicketNumber, mergeId }: MergedBannerProps) {
  const router = useRouter()
  const [unmerging, setUnmerging] = useState(false)

  async function handleUnmerge() {
    if (!mergeId) return
    if (!confirm('Un-merge this ticket? It will be restored to its previous status.')) return
    setUnmerging(true)
    const result = await unmergeTicket(mergeId)
    setUnmerging(false)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">
          This ticket was merged into{' '}
          <Link href={`/helpdesk/tickets/${targetTicketId}`} className="font-semibold text-amber-900 underline hover:text-amber-700">
            {targetTicketNumber}
          </Link>
        </p>
        <p className="text-xs text-amber-600 mt-0.5">Replies and updates should be made on the target ticket.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {mergeId && (
          <button
            onClick={handleUnmerge}
            disabled={unmerging}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {unmerging ? 'Restoring...' : 'Un-merge'}
          </button>
        )}
        <Link
          href={`/helpdesk/tickets/${targetTicketId}`}
          className="rounded-md bg-amber-200/60 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors no-underline"
        >
          Go to {targetTicketNumber}
        </Link>
      </div>
    </div>
  )
}
