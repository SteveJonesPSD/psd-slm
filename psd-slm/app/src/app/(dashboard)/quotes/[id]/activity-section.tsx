'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types/database'

interface ActivityEntry {
  id: string
  action: string
  created_at: string
  users: {
    first_name: string
    last_name: string
    initials: string | null
    color: string | null
  } | null
}

interface ActivitySectionProps {
  activities: ActivityEntry[]
}

export function ActivitySection({ activities }: ActivitySectionProps) {
  const [open, setOpen] = useState(false)

  if (activities.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
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
        <div className="px-5 pb-5 space-y-3">
          {activities.map((a) => {
            const u = a.users
            return (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                {u && <Avatar user={u as User} size={24} />}
                <div>
                  <span className="font-medium">
                    {u ? `${u.first_name} ${u.last_name}` : 'System'}
                  </span>
                  <span className="text-slate-500"> {a.action}</span>
                  <div className="text-xs text-slate-400 mt-0.5">{formatDate(a.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
