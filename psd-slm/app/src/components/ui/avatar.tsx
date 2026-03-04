'use client'

import { useState } from 'react'
import type { User } from '@/types/database'

interface AvatarProps {
  user: Pick<User, 'first_name' | 'last_name' | 'initials' | 'color'> & { avatar_url?: string | null }
  size?: number
  avatarUrl?: string | null
}

export function Avatar({ user, size = 28, avatarUrl }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = user.initials || (user.first_name[0] + user.last_name[0]).toUpperCase()
  const url = avatarUrl ?? user.avatar_url

  return (
    <div
      title={`${user.first_name} ${user.last_name}`}
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        backgroundColor: user.color || '#6366f1',
        fontSize: size * 0.4,
      }}
    >
      {url && !imgError ? (
        <img
          src={url}
          alt={`${user.first_name} ${user.last_name}`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}
