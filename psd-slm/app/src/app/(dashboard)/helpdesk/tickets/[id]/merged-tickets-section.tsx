'use client'

import { useState } from 'react'
import Link from 'next/link'
import { unmergeTicket } from '../../actions'

interface MergedTicket {
  id: string
  source_ticket_id: string
  merged_at: string
  source: { id: string; ticket_number: string; subject: string; status: string }
  merger: { first_name: string; last_name: string }
}

interface MergedTicketsSectionProps {
  mergedTickets: MergedTicket[]
}

export function MergedTicketsSection({ mergedTickets: initialMerged }: MergedTicketsSectionProps) {
  const [merged, setMerged] = useState(initialMerged)
  const [collapsed, setCollapsed] = useState(false)
  const [unmerging, setUnmerging] = useState<string | null>(null)

  if (merged.length === 0) return null

  async function handleUnmerge(mergeId: string) {
    if (!confirm('Un-merge this ticket? It will be restored to its previous status.')) return
    setUnmerging(mergeId)
    const result = await unmergeTicket(mergeId)
    setUnmerging(null)
    if (result.error) {
      alert(result.error)
    } else {
      setMerged(prev => prev.filter(m => m.id !== mergeId))
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">Merged Tickets</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {merged.length}
          </span>
        </div>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {merged.map(m => (
            <div key={m.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/helpdesk/tickets/${m.source.id}`}
                  className="text-xs font-semibold text-slate-700 hover:text-indigo-600 no-underline"
                >
                  {m.source.ticket_number}
                </Link>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{m.source.subject}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Merged by {m.merger.first_name} {m.merger.last_name} on{' '}
                  {new Date(m.merged_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleUnmerge(m.id)}
                disabled={unmerging === m.id}
                className="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors"
                title="Un-merge this ticket"
              >
                {unmerging === m.id ? 'Restoring...' : 'Un-merge'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
