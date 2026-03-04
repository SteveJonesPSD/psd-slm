'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, SO_LINE_STATUS_CONFIG } from '@/components/ui/badge'
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

interface SoActivityProps {
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
  if (!details) {
    switch (action) {
      case 'created': return 'Created this sales order'
      case 'cancelled': return 'Cancelled this sales order'
      default: return action
    }
  }

  switch (action) {
    case 'created':
      return `Created sales order${details.so_number ? ` ${details.so_number}` : ''}`
    case 'line_status_changed':
      return `Updated line "${details.description || 'item'}"`
    case 'cancelled':
      return 'Cancelled this sales order'
    default:
      return action
  }
}

export function SoActivity({ activities }: SoActivityProps) {
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
                  {/* Line status change badges */}
                  {a.action === 'line_status_changed' &&
                    typeof details?.from_status === 'string' &&
                    typeof details?.to_status === 'string' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {(() => {
                          const from = SO_LINE_STATUS_CONFIG[details.from_status as string]
                          const to = SO_LINE_STATUS_CONFIG[details.to_status as string]
                          return (
                            <>
                              <Badge
                                label={from?.label ?? String(details.from_status)}
                                color={from?.color ?? '#6b7280'}
                                bg={from?.bg ?? '#f3f4f6'}
                              />
                              <span className="text-xs text-slate-400">&rarr;</span>
                              <Badge
                                label={to?.label ?? String(details.to_status)}
                                color={to?.color ?? '#6b7280'}
                                bg={to?.bg ?? '#f3f4f6'}
                              />
                            </>
                          )
                        })()}
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
