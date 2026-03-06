'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, QUOTE_STATUS_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/utils'
import { reactivateQuote } from '../actions'

interface VersionRow {
  id: string
  quote_number: string
  version: number
  status: string
  revision_notes: string | null
  created_at: string
  assigned_to: string | null
  revised_by: string | null
  users: { first_name: string; last_name: string } | null
  revised_user: { first_name: string; last_name: string } | null
}

interface VersionHistoryPanelProps {
  versions: VersionRow[]
  currentQuoteId: string
}

export function VersionHistoryPanel({ versions, currentQuoteId }: VersionHistoryPanelProps) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null)

  if (versions.length <= 1) return null

  const sorted = [...versions].sort((a, b) => b.version - a.version)
  const hasRevisedBy = sorted.some((v) => v.revised_by && v.revised_by !== v.assigned_to)

  const handleReactivate = async (quoteId: string) => {
    setReactivatingId(quoteId)
    const result = await reactivateQuote(quoteId)
    setReactivatingId(null)
    setShowConfirmModal(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <h3 className="text-[15px] font-semibold">
          Version History ({versions.length} versions)
        </h3>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Version</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote #</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Owner</th>
                {hasRevisedBy && (
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Revised By</th>
                )}
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => {
                const isCurrent = v.id === currentQuoteId
                const isRevised = v.status === 'revised'
                const statusCfg = QUOTE_STATUS_CONFIG[v.status as keyof typeof QUOTE_STATUS_CONFIG]

                return (
                  <tr
                    key={v.id}
                    className={`border-t border-slate-100 ${isCurrent ? 'bg-blue-50/50' : ''} ${!isCurrent ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={!isCurrent ? () => router.push(`/quotes/${v.id}`) : undefined}
                  >
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center gap-1 font-semibold ${isCurrent ? 'text-blue-700' : ''}`}>
                        v{v.version}
                        {isCurrent && <span className="ml-1.5 text-xs text-blue-500">(current)</span>}
                        {v.revision_notes && (
                          <span className="group relative">
                            <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                            </svg>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-pre-wrap rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100 max-w-xs w-max">
                              {v.revision_notes}
                            </span>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-medium">{v.quote_number}</td>
                    <td className="px-5 py-2.5">
                      {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : v.status}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDate(v.created_at)}</td>
                    <td className="px-5 py-2.5 text-slate-500">
                      {v.users ? `${v.users.first_name} ${v.users.last_name}` : '\u2014'}
                    </td>
                    {hasRevisedBy && (
                      <td className="px-5 py-2.5 text-slate-500">
                        {v.revised_by && v.revised_by !== v.assigned_to && v.revised_user
                          ? `${v.revised_user.first_name} ${v.revised_user.last_name}`
                          : '\u2014'}
                      </td>
                    )}
                    <td className="px-5 py-2.5 text-right">
                      {isRevised && !isCurrent && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowConfirmModal(v.id)
                          }}
                        >
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reactivate confirmation modal */}
      {showConfirmModal && (
        <Modal title="Reactivate Version" onClose={() => setShowConfirmModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            This will reactivate the selected version and mark the current active version as revised. Continue?
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleReactivate(showConfirmModal)}
              disabled={reactivatingId === showConfirmModal}
            >
              {reactivatingId === showConfirmModal ? 'Reactivating...' : 'Reactivate'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
