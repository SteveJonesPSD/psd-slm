'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG, canTransition } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem, OnsiteJobAuditEntry, OnsiteJobCategory, OjiStatus } from '@/lib/onsite-jobs/types'
import { updateOnsiteJobStatus, addEngineerNote, notifySales, cancelOnsiteJobItem } from '../actions'

interface OnsiteJobDetailProps {
  item: OnsiteJobItem & { escalation_ticket?: { id: string; ticket_number: string; subject: string } | null }
  audit: OnsiteJobAuditEntry[]
  categories: OnsiteJobCategory[]
  canEdit: boolean
  canNotifySales: boolean
  canCancel: boolean
}

export function OnsiteJobDetail({ item, audit, categories, canEdit, canNotifySales, canCancel }: OnsiteJobDetailProps) {
  const router = useRouter()
  const [notes, setNotes] = useState(item.engineer_notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusCfg = OJI_STATUS_CONFIG[item.status]
  const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
  const cat = item.category

  async function handleStatusChange(newStatus: OjiStatus) {
    setLoading(true)
    setError(null)
    const result = await updateOnsiteJobStatus(
      item.id,
      newStatus,
      newStatus === 'complete' ? notes : undefined,
    )
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  async function handleSaveNotes() {
    setLoading(true)
    setError(null)
    const result = await addEngineerNote(item.id, notes)
    if (result.error) setError(result.error)
    setLoading(false)
    router.refresh()
  }

  async function handleNotifySales() {
    setLoading(true)
    setError(null)
    const result = await notifySales(item.id)
    if (result.error) setError(result.error)
    setLoading(false)
    router.refresh()
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this onsite job?')) return
    setLoading(true)
    setError(null)
    const result = await cancelOnsiteJobItem(item.id)
    if (result.error) setError(result.error)
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      {/* Back link */}
      <Link href="/helpdesk/onsite-jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline mb-6 block">
        &larr; Onsite Jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{item.ref_number}</h1>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
          </div>
          <p className="text-lg text-slate-700 dark:text-slate-300">{item.subject}</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0 flex-wrap">
          {canEdit && item.status === 'pending' && (
            <Button size="sm" variant="primary" onClick={() => handleStatusChange('in_progress')} disabled={loading}>
              Start Work
            </Button>
          )}
          {canEdit && item.status === 'in_progress' && (
            <Button size="sm" variant="success" onClick={() => handleStatusChange('complete')} disabled={loading || !notes.trim()}>
              Complete
            </Button>
          )}
          {canEdit && item.status === 'escalated' && (
            <Button size="sm" variant="primary" onClick={() => handleStatusChange('in_progress')} disabled={loading}>
              Start Work
            </Button>
          )}
          {canCancel && ['pending', 'in_progress'].includes(item.status) && (
            <Button size="sm" variant="danger" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Details card */}
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <DetailField label="Customer" value={item.customer?.name} />
              <DetailField label="Category" value={cat?.name} />
              <DetailField label="Room / Location" value={item.room_location} />
              <DetailField label="Source" value={item.source_type === 'portal' ? 'Portal' : item.source_type === 'ticket_push' ? 'Ticket Push' : item.source_type === 'escalation' ? 'Escalation' : 'Internal'} />
              {item.requested_by_contact && (
                <DetailField label="Requested By" value={`${item.requested_by_contact.first_name} ${item.requested_by_contact.last_name}`} />
              )}
              {item.on_behalf_of_name && (
                <DetailField label="On Behalf Of" value={item.on_behalf_of_name} />
              )}
              {item.preferred_datetime && (
                <DetailField label="Preferred Date/Time" value={new Date(item.preferred_datetime).toLocaleString('en-GB')} />
              )}
              <DetailField label="Logged" value={new Date(item.created_at).toLocaleString('en-GB')} />
              {item.visit_instance && (
                <DetailField label="Linked Visit" value={new Date(item.visit_instance.visit_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} />
              )}
              {item.source_ticket && (
                <div>
                  <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Source Ticket</div>
                  <Link href={`/helpdesk/tickets/${item.source_ticket.id}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 no-underline">
                    {item.source_ticket.ticket_number}
                  </Link>
                </div>
              )}
              {(item as Record<string, unknown>).escalation_ticket && (
                <div>
                  <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Escalation Ticket</div>
                  <Link href={`/helpdesk/tickets/${((item as Record<string, unknown>).escalation_ticket as Record<string, unknown>).id}`} className="text-red-600 dark:text-red-400 hover:text-red-800 no-underline">
                    {((item as Record<string, unknown>).escalation_ticket as Record<string, unknown>).ticket_number as string}
                  </Link>
                </div>
              )}
            </div>

            {item.description && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Description</div>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
              </div>
            )}
          </div>

          {/* Engineer notes */}
          {canEdit && ['in_progress', 'complete', 'escalated'].includes(item.status) && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Engineer Notes</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add your notes about this job..."
                disabled={item.status === 'complete'}
              />
              {item.status !== 'complete' && (
                <div className="flex items-center gap-3 mt-3">
                  <Button size="sm" variant="primary" onClick={handleSaveNotes} disabled={loading || !notes.trim()}>
                    Save Notes
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Completed notes (read-only) */}
          {item.status === 'complete' && item.engineer_notes && !canEdit && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
              <h2 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Engineer&apos;s Notes</h2>
              <p className="text-sm text-green-700 dark:text-green-400 whitespace-pre-wrap">{item.engineer_notes}</p>
            </div>
          )}

          {/* Notify Sales */}
          {canNotifySales && ['in_progress', 'complete'].includes(item.status) && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sales Notification</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Alert the sales team about a potential opportunity at this customer.</p>
                </div>
                {item.notify_sales_at ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Sales Notified {new Date(item.notify_sales_at).toLocaleString('en-GB')}
                  </span>
                ) : (
                  <Button size="sm" variant="default" onClick={handleNotifySales} disabled={loading}>
                    Notify Sales
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Audit timeline sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 sticky top-24">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Activity</h2>
            <div className="space-y-4">
              {audit.map(entry => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
              {audit.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-slate-700 dark:text-slate-300">{value || '\u2014'}</div>
    </div>
  )
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  status_changed: 'Status changed',
  note_added: 'Note added',
  engineer_note: 'Engineer note',
  sales_notified: 'Sales notified',
  ticket_pushed_to: 'Pushed from ticket',
  ticket_closed_source: 'Source ticket closed',
  escalated: 'Escalated',
  visit_linked: 'Visit linked',
  cancelled: 'Cancelled',
}

const ACTOR_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  portal_user: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  internal_user: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  system: { bg: 'bg-gray-50 dark:bg-slate-700', text: 'text-gray-600 dark:text-slate-400' },
}

function AuditRow({ entry }: { entry: OnsiteJobAuditEntry }) {
  const label = AUDIT_ACTION_LABELS[entry.action] || entry.action
  const actorColors = ACTOR_TYPE_COLORS[entry.actor_type] || ACTOR_TYPE_COLORS.system

  let actorName = 'System'
  if (entry.actor_user) {
    actorName = `${entry.actor_user.first_name} ${entry.actor_user.last_name}`
  } else if (entry.actor_portal_user?.contacts) {
    actorName = `${entry.actor_portal_user.contacts.first_name} ${entry.actor_portal_user.contacts.last_name}`
  }

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <div className={`h-2 w-2 rounded-full mt-1.5 ${
          entry.action === 'escalated' ? 'bg-red-500' :
          entry.action === 'status_changed' ? 'bg-blue-500' :
          entry.action === 'created' ? 'bg-green-500' :
          entry.action === 'cancelled' ? 'bg-gray-400' :
          'bg-slate-300 dark:bg-slate-600'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${actorColors.bg} ${actorColors.text}`}>
            {entry.actor_type === 'portal_user' ? 'Portal' : entry.actor_type === 'internal_user' ? 'Staff' : 'System'}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{actorName}</div>
        {entry.old_value && entry.new_value && entry.action === 'status_changed' && (
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{entry.old_value} → {entry.new_value}</div>
        )}
        {entry.note && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">{entry.note}</div>
        )}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
          {new Date(entry.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
