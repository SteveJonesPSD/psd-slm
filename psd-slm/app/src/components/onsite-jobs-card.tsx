'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG, STATUS_TRANSITIONS } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem, OnsiteJobCategory, OjiStatus } from '@/lib/onsite-jobs/types'
import { updateOnsiteJobStatus, addEngineerNote, notifySales } from '@/app/(dashboard)/helpdesk/onsite-jobs/actions'

interface OnsiteJobsCardProps {
  items: OnsiteJobItem[]
  customerId: string
  customerName?: string
}

export function OnsiteJobsCard({ items, customerId, customerName }: OnsiteJobsCardProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null)

  const openItems = items.filter(i => ['pending', 'in_progress', 'escalated'].includes(i.status))
  const completedItems = items.filter(i => i.status === 'complete')

  if (items.length === 0) return null

  function showFeedback(id: string, msg: string, type: 'success' | 'error') {
    setFeedback({ id, msg, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  async function handleStatusChange(itemId: string, currentStatus: OjiStatus, newStatus: OjiStatus, note?: string) {
    setSaving(itemId)
    const result = await updateOnsiteJobStatus(itemId, newStatus, note)
    if (result.error) {
      showFeedback(itemId, result.error, 'error')
    } else {
      showFeedback(itemId, `Status updated to ${OJI_STATUS_CONFIG[newStatus]?.label || newStatus}`, 'success')
      router.refresh()
    }
    setSaving(null)
  }

  async function handleAddNote(itemId: string) {
    const text = noteText[itemId]?.trim()
    if (!text) return
    setSaving(itemId)
    const result = await addEngineerNote(itemId, text)
    if (result.error) {
      showFeedback(itemId, result.error, 'error')
    } else {
      setNoteText(prev => ({ ...prev, [itemId]: '' }))
      showFeedback(itemId, 'Note added', 'success')
      router.refresh()
    }
    setSaving(null)
  }

  async function handleNotifySales(itemId: string) {
    setSaving(itemId)
    const result = await notifySales(itemId)
    if (result.error) {
      showFeedback(itemId, result.error, 'error')
    } else {
      showFeedback(itemId, 'Sales notified', 'success')
      router.refresh()
    }
    setSaving(null)
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
          Onsite Jobs
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {openItems.length} open
        </span>
      </div>

      {/* Open items */}
      <div className="space-y-2">
        {openItems.map(item => {
          const isExpanded = expandedId === item.id
          const statusCfg = OJI_STATUS_CONFIG[item.status]
          const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
          const transitions = STATUS_TRANSITIONS[item.status] || []
          const cat = item.category as OnsiteJobCategory | null
          const itemFeedback = feedback?.id === item.id ? feedback : null
          const isSaving = saving === item.id

          return (
            <div key={item.id} className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
              {/* Summary row — tap to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{item.ref_number}</span>
                    {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                  </div>
                  <p className="text-sm text-slate-900 dark:text-slate-200 truncate">{item.subject}</p>
                  {item.room_location && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Room: {item.room_location}</p>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                  {/* Description */}
                  {item.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
                  )}

                  {/* Category */}
                  {cat && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cat.colour || '#6b7280' }} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{cat.name}</span>
                    </div>
                  )}

                  {/* Existing engineer notes */}
                  {item.engineer_notes && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Engineer Notes</p>
                      <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{item.engineer_notes}</p>
                    </div>
                  )}

                  {/* Feedback */}
                  {itemFeedback && (
                    <div className={`rounded-lg p-2 text-center text-xs font-medium ${
                      itemFeedback.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {itemFeedback.msg}
                    </div>
                  )}

                  {/* Status action buttons */}
                  {transitions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {transitions.filter(t => t !== 'cancelled').map(nextStatus => {
                        const nextCfg = OJI_STATUS_CONFIG[nextStatus]
                        const needsNote = nextStatus === 'complete'
                        return (
                          <button
                            key={nextStatus}
                            disabled={isSaving || (needsNote && !noteText[item.id]?.trim())}
                            onClick={() => handleStatusChange(
                              item.id,
                              item.status,
                              nextStatus,
                              needsNote ? noteText[item.id]?.trim() : undefined
                            )}
                            className="rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                            style={{
                              backgroundColor: nextCfg?.bg || '#f3f4f6',
                              color: nextCfg?.color || '#6b7280',
                            }}
                          >
                            {isSaving ? '...' : nextStatus === 'in_progress' ? 'Start Work' : nextStatus === 'complete' ? 'Complete' : nextStatus === 'escalated' ? 'Escalate' : nextCfg?.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Add note */}
                  <div>
                    <textarea
                      value={noteText[item.id] || ''}
                      onChange={e => setNoteText(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder={item.status === 'in_progress' ? 'Add note (required for completion)...' : 'Add engineer note...'}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleAddNote(item.id)}
                      disabled={isSaving || !noteText[item.id]?.trim()}
                      className="mt-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>

                  {/* Notify sales button */}
                  {!item.notify_sales_at && (
                    <button
                      onClick={() => handleNotifySales(item.id)}
                      disabled={isSaving}
                      className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? 'Notifying...' : 'Notify Sales'}
                    </button>
                  )}
                  {item.notify_sales_at && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                      Sales notified {new Date(item.notify_sales_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                  )}

                  {/* Logged date */}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Logged {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {item.requested_by_contact && ` by ${item.requested_by_contact.first_name} ${item.requested_by_contact.last_name}`}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Completed summary */}
      {completedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {completedItems.length} completed job{completedItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
