'use client'

import { formatRelativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { User } from '@/types/database'

interface ActivityEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

interface InvoiceActivityProps {
  activities: ActivityEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  'invoice.created': 'Created invoice',
  'invoice.updated': 'Updated invoice',
  'invoice.status_changed': 'Changed status',
  'invoice.sent': 'Sent invoice',
  'invoice.paid': 'Marked as paid',
  'invoice.voided': 'Voided invoice',
  'invoice.credit_note_created': 'Created credit note',
}

export function InvoiceActivity({ activities }: InvoiceActivityProps) {
  if (!activities || activities.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-[15px] font-semibold mb-4">Activity</h3>
      <div className="space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="flex items-start gap-3">
            <Avatar user={a.users as User} size={28} />
            <div>
              <div className="text-sm text-slate-700">
                <span className="font-medium">
                  {a.users ? `${a.users.first_name} ${a.users.last_name}` : 'System'}
                </span>
                {' '}
                {ACTION_LABELS[a.action] || a.action}
                {a.details && 'from' in a.details && 'to' in a.details && (
                  <span className="text-slate-400">
                    {' '}{String(a.details.from)} &rarr; {String(a.details.to)}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {formatRelativeTime(a.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
