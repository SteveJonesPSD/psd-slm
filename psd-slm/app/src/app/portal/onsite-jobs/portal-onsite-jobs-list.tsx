'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem, OnsiteJobCategory } from '@/lib/onsite-jobs/types'
import { EscalationModal } from './escalation-modal'

interface PortalOnsiteJobsListProps {
  items: OnsiteJobItem[]
  nextVisit: {
    visit_date: string
    start_time: string | null
    end_time: string | null
    status: string
  } | null
  openCount: number
  hasOnsiteContract: boolean
  portalUserId: string
}

type Tab = 'open' | 'complete' | 'all'

export function PortalOnsiteJobsList({ items, nextVisit, openCount, hasOnsiteContract, portalUserId }: PortalOnsiteJobsListProps) {
  const [tab, setTab] = useState<Tab>('open')
  const [showEscalation, setShowEscalation] = useState(false)

  const filtered = items.filter(item => {
    if (tab === 'open') return ['pending', 'in_progress', 'escalated'].includes(item.status)
    if (tab === 'complete') return item.status === 'complete'
    return true
  })

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      {/* Next Visit Banner */}
      {nextVisit ? (
        <div className={`rounded-xl p-4 mb-8 ${
          nextVisit.status === 'confirmed'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
              nextVisit.status === 'confirmed' ? 'bg-green-100 dark:bg-green-800' : 'bg-amber-100 dark:bg-amber-800'
            }`}>
              <svg className={`h-5 w-5 ${nextVisit.status === 'confirmed' ? 'text-green-600 dark:text-green-300' : 'text-amber-600 dark:text-amber-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${nextVisit.status === 'confirmed' ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
                Your next scheduled ICT visit is{' '}
                {new Date(nextVisit.visit_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {nextVisit.start_time ? ` at ${nextVisit.start_time}` : ''}
              </p>
              <p className={`text-xs mt-0.5 ${nextVisit.status === 'confirmed' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {nextVisit.status === 'confirmed' ? 'Confirmed' : 'Scheduled — awaiting confirmation'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 mb-8 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">No visit currently scheduled.</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <Link
          href="/portal/onsite-jobs/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500 bg-blue-500/15 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-shadow no-underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Log New Support Job
        </Link>
        <button
          onClick={() => setShowEscalation(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-shadow"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Request Urgent Assistance
        </button>
      </div>

      {/* Page title */}
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Your Onsite Support Jobs</h1>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['open', 'complete', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t === 'open' ? `Open (${items.filter(i => ['pending', 'in_progress', 'escalated'].includes(i.status)).length})` : t === 'complete' ? 'Complete' : 'All'}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.map(item => {
          const statusCfg = OJI_STATUS_CONFIG[item.status]
          const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
          const cat = item.category as OnsiteJobCategory | null

          return (
            <Link
              key={item.id}
              href={`/portal/onsite-jobs/${item.id}`}
              className="block rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:shadow-md transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">{item.ref_number}</span>
                    {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                    {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    {cat && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${cat.colour || '#6b7280'}18`, color: cat.colour || '#6b7280' }}
                      >
                        {cat.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{item.subject}</p>
                  {item.room_location && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.room_location}</p>
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </div>
              </div>

              {/* Engineer notes (if complete) */}
              {item.status === 'complete' && item.engineer_notes && (
                <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <p className="text-[11px] font-medium text-green-700 dark:text-green-300 mb-1">Engineer&apos;s Notes</p>
                  <p className="text-xs text-green-600 dark:text-green-400 line-clamp-2">{item.engineer_notes}</p>
                </div>
              )}
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {tab === 'open' ? 'No open support jobs' : tab === 'complete' ? 'No completed jobs yet' : 'No support jobs found'}
            </p>
          </div>
        )}
      </div>

      {/* Escalation modal */}
      {showEscalation && (
        <EscalationModal
          onClose={() => setShowEscalation(false)}
          hasOnsiteContract={hasOnsiteContract}
        />
      )}
    </div>
  )
}
