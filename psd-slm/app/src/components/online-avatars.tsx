'use client'

import { useState } from 'react'
import type { OnlineUser } from '@/components/use-system-presence'

interface OnlineAvatarsProps {
  users: OnlineUser[]
  collapsed: boolean
}

const MAX_EXPANDED = 6
const MAX_COLLAPSED = 5

export function OnlineAvatars({ users, collapsed }: OnlineAvatarsProps) {
  if (users.length === 0) return null

  if (collapsed) {
    return <CollapsedAvatars users={users} />
  }

  return <ExpandedAvatars users={users} />
}

function ExpandedAvatars({ users }: { users: OnlineUser[] }) {
  const visible = users.slice(0, MAX_EXPANDED)
  const overflow = users.length - MAX_EXPANDED

  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
        Online
      </div>
      <div className="flex items-center -space-x-2">
        {visible.map((user) => (
          <Avatar key={user.id} user={user} size={28} />
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-300 ring-2 ring-slate-900 z-10">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}

function CollapsedAvatars({ users }: { users: OnlineUser[] }) {
  const visible = users.slice(0, MAX_COLLAPSED)
  const overflow = users.length - MAX_COLLAPSED

  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      {visible.map((user) => (
        <Avatar key={user.id} user={user} size={24} />
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-slate-300">
          +{overflow}
        </div>
      )}
    </div>
  )
}

function Avatar({ user, size }: { user: OnlineUser; size: number }) {
  const [imgError, setImgError] = useState(false)
  const initials = user.initials || (user.firstName[0] + user.lastName[0])
  const isIdle = user.status === 'idle'
  const tooltipText = `${user.firstName} ${user.lastName}${isIdle ? ' (idle)' : ''}`

  return (
    <div className="relative group" title={tooltipText}>
      <div
        className={`flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-slate-900 transition-opacity overflow-hidden ${
          isIdle ? 'opacity-40' : ''
        }`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          backgroundColor: user.color || '#6366f1',
        }}
      >
        {user.avatarUrl && !imgError ? (
          <img
            src={user.avatarUrl}
            alt={`${user.firstName} ${user.lastName}`}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          initials
        )}
      </div>
      {!isIdle && (
        user.isMobile ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-slate-900 ring-1 ring-slate-900"
            style={{ width: size * 0.42, height: size * 0.42 }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-emerald-400"
              style={{ width: size * 0.28, height: size * 0.28 }}
            >
              <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2H7zm5 18a1 1 0 110-2 1 1 0 010 2zm4-4H8V5h8v11z" />
            </svg>
          </span>
        ) : (
          <span
            className="absolute bottom-0 right-0 block rounded-full bg-emerald-500 ring-2 ring-slate-900"
            style={{
              width: size * 0.32,
              height: size * 0.32,
            }}
          />
        )
      )}
    </div>
  )
}
