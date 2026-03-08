'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem, OnsiteJobAuditEntry, OnsiteJobCategory } from '@/lib/onsite-jobs/types'
import { cancelPortalOjiAction } from '../portal-actions'

interface PortalOnsiteJobDetailProps {
  item: OnsiteJobItem
  audit: OnsiteJobAuditEntry[]
  portalUserId: string
}

export function PortalOnsiteJobDetail({ item, audit, portalUserId }: PortalOnsiteJobDetailProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusCfg = OJI_STATUS_CONFIG[item.status]
  const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
  const cat = item.category as OnsiteJobCategory | null
  const canCancel = item.status === 'pending' && item.created_by_portal_user_id === portalUserId

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this support job?')) return
    setLoading(true)
    const result = await cancelPortalOjiAction(item.id)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.push('/portal/onsite-jobs')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <Link
        href="/portal/onsite-jobs"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline mb-6 block"
      >
        &larr; Back to Onsite Jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">{item.ref_number}</span>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{item.subject}</h1>
        </div>
        {canCancel && (
          <Button size="sm" variant="danger" onClick={handleCancel} disabled={loading} className="mt-3 sm:mt-0">
            Cancel Request
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Details card */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {cat && (
            <div>
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Category</div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${cat.colour || '#6b7280'}18`, color: cat.colour || '#6b7280' }}
              >
                {cat.name}
              </span>
            </div>
          )}
          {item.room_location && (
            <DetailField label="Room / Location" value={item.room_location} />
          )}
          {item.on_behalf_of_name && (
            <DetailField label="Person Needing Help" value={item.on_behalf_of_name} />
          )}
          {item.preferred_datetime && (
            <DetailField label="Preferred Date/Time" value={new Date(item.preferred_datetime).toLocaleString('en-GB')} />
          )}
          <DetailField label="Logged" value={new Date(item.created_at).toLocaleString('en-GB')} />
          {item.completed_at && (
            <DetailField label="Completed" value={new Date(item.completed_at).toLocaleString('en-GB')} />
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
      {item.engineer_notes && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6 mb-8">
          <h2 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Engineer&apos;s Notes</h2>
          <p className="text-sm text-green-700 dark:text-green-400 whitespace-pre-wrap">{item.engineer_notes}</p>
        </div>
      )}

      {/* Audit trail */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Activity</h2>
        <div className="space-y-3">
          {audit.map(entry => {
            let label = entry.action
            if (entry.action === 'created') label = 'Logged'
            else if (entry.action === 'status_changed') label = `Status updated to ${entry.new_value}`
            else if (entry.action === 'engineer_note') label = 'Notes added by engineer'
            else if (entry.action === 'escalated') label = 'Escalation raised'
            else if (entry.action === 'cancelled') label = 'Cancelled'
            else if (entry.action === 'visit_linked') label = `Linked to visit on ${entry.new_value ? new Date(entry.new_value).toLocaleDateString('en-GB') : ''}`

            let actorName = ''
            if (entry.actor_portal_user?.contacts) {
              actorName = `${entry.actor_portal_user.contacts.first_name} ${entry.actor_portal_user.contacts.last_name}`
            }

            return (
              <div key={entry.id} className="flex gap-3 text-sm">
                <div className="flex-shrink-0 mt-1">
                  <div className={`h-2 w-2 rounded-full ${
                    entry.action === 'created' ? 'bg-green-500' :
                    entry.action === 'escalated' ? 'bg-red-500' :
                    entry.action === 'cancelled' ? 'bg-gray-400' :
                    'bg-blue-500'
                  }`} />
                </div>
                <div>
                  <span className="text-slate-700 dark:text-slate-300">{label}</span>
                  {actorName && <span className="text-slate-400 dark:text-slate-500 ml-1">by {actorName}</span>}
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(entry.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          {audit.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">No activity recorded yet.</p>
          )}
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
