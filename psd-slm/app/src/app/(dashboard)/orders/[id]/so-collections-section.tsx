'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  collected: { label: 'Collected', color: '#059669', bg: '#ecfdf5' },
  partial: { label: 'Partial', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

interface CollectionRow {
  id: string
  slip_number: string
  status: string
  prepared_at: string | null
  collected_at: string | null
  notes: string | null
  prepared_by_user: { id: string; first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null } | null
  collected_by_user: { id: string; first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null } | null
  job_collection_lines: { id: string; is_confirmed: boolean }[] | null
}

export function SoCollectionsSection({ collections }: { collections: CollectionRow[] }) {
  const active = collections.filter(c => c.status !== 'cancelled')

  if (active.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">
            Collections
            <span className="ml-2 text-xs font-normal text-slate-400">({active.length})</span>
          </h3>
          <Link href="/collections">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {active.map(col => {
          const badge = STATUS_BADGE[col.status] || STATUS_BADGE.pending
          const lines = col.job_collection_lines || []
          const confirmedCount = lines.filter(l => l.is_confirmed).length
          const preparedBy = col.prepared_by_user
          const collectedBy = col.collected_by_user

          return (
            <div key={col.id} className="px-5 py-3 hover:bg-slate-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <Link href={`/collections/${col.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">
                  {col.slip_number}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge label={badge.label} color={badge.color} bg={badge.bg} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/api/collections/${col.id}/slip`, '_blank')}
                  >
                    Print
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{lines.length} item{lines.length !== 1 ? 's' : ''}{col.status === 'partial' ? ` (${confirmedCount} confirmed)` : ''}</span>
                {preparedBy && (
                  <span className="flex items-center gap-1">
                    <Avatar user={preparedBy} size={16} />
                    {preparedBy.first_name}
                    {col.prepared_at && (
                      <span className="text-slate-400 ml-1">
                        {new Date(col.prepared_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </span>
                )}
                {collectedBy && col.collected_at && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Avatar user={collectedBy} size={16} />
                    Collected {new Date(col.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
