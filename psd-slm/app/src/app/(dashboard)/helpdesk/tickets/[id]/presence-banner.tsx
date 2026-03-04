'use client'

import { useState } from 'react'
import type { PresenceViewer } from '../../actions'

interface PresenceBannerProps {
  viewers: PresenceViewer[]
}

function formatViewerNames(viewers: PresenceViewer[]): string {
  const names = viewers.map(v => `${v.firstName} ${v.lastName}`)
  if (names.length === 1) return `${names[0]} is also viewing this ticket`
  if (names.length === 2) return `${names[0]} and ${names[1]} are also viewing this ticket`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are also viewing this ticket`
}

function ViewerAvatar({ viewer }: { viewer: PresenceViewer }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-50 text-[9px] font-semibold text-white overflow-hidden"
      style={{ backgroundColor: viewer.color || '#6366f1' }}
      title={`${viewer.firstName} ${viewer.lastName}`}
    >
      {viewer.avatarUrl && !imgError ? (
        <img
          src={viewer.avatarUrl}
          alt={`${viewer.firstName} ${viewer.lastName}`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        viewer.initials || '?'
      )}
    </div>
  )
}

export function PresenceBanner({ viewers }: PresenceBannerProps) {
  if (viewers.length === 0) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5">
      {/* Eye icon */}
      <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>

      {/* Avatar circles */}
      <div className="flex -space-x-1.5">
        {viewers.map(v => (
          <ViewerAvatar key={v.id} viewer={v} />
        ))}
      </div>

      {/* Text */}
      <span className="text-xs font-medium text-amber-800">
        {formatViewerNames(viewers)}
      </span>
    </div>
  )
}
