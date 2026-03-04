'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, PO_STATUS_CONFIG, PO_LINE_STATUS_CONFIG } from '@/components/ui/badge'
import type { Json } from '@/types/database'

interface ActivityEntry {
  id: string
  action: string
  details: Json | null
  created_at: string
  users: {
    first_name: string
    last_name: string
    initials: string | null
    color: string | null
  } | null
}

interface PoActivityProps {
  activities: ActivityEntry[]
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function describeAction(action: string, details: Record<string, unknown> | null): string {
  if (!details) return action

  switch (action) {
    case 'po.created':
      return `Created purchase order from ${details.so_number || 'sales order'}`
    case 'po.sent':
      return `Marked as sent to ${details.supplier_name || 'supplier'}`
    case 'po.acknowledged':
      return `Supplier acknowledged${details.supplier_ref ? ` (ref: ${details.supplier_ref})` : ''}`
    case 'po.goods_received':
      return `Received ${details.qty_received || '?'} x ${details.product_name || 'item'} (total: ${details.total_received || '?'})`
    case 'po.cancelled':
      return 'Cancelled this purchase order'
    case 'po.price_adjusted':
      return `Adjusted price on ${details.product_name || 'item'}`
    default:
      return action
  }
}

export function PoActivity({ activities }: PoActivityProps) {
  const [open, setOpen] = useState(false)

  if (activities.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <h3 className="text-[15px] font-semibold">Activity</h3>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {activities.map((a) => {
            const details = a.details as Record<string, unknown> | null

            return (
              <div key={a.id} className="flex gap-3">
                {a.users ? (
                  <Avatar
                    user={{
                      first_name: a.users.first_name,
                      last_name: a.users.last_name,
                      initials: a.users.initials,
                      color: a.users.color,
                    }}
                    size={28}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">
                      {a.users ? `${a.users.first_name} ${a.users.last_name}` : 'System'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {relativeTime(a.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {describeAction(a.action, details)}
                  </p>
                  {a.action === 'po.goods_received' && Array.isArray(details?.serials) && (details.serials as string[]).length > 0 && (
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      SN: {(details!.serials as string[]).join(', ')}
                    </div>
                  )}
                  {a.action === 'po.price_adjusted' && details && (
                    <div className="mt-1 text-xs text-slate-400">
                      {String(details.old_cost)} &rarr; {String(details.new_cost)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
