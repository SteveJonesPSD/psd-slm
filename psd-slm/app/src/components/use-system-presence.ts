'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const HEARTBEAT_INTERVAL = 15_000  // 15 seconds
const ACTIVE_WINDOW = 2 * 60 * 1000  // 2 minutes — matches server threshold

export interface OnlineUser {
  id: string
  firstName: string
  lastName: string
  initials: string | null
  color: string | null
  avatarUrl: string | null
  status: 'active' | 'idle'
}

export function useSystemPresence(): OnlineUser[] {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const lastInteractionRef = useRef<number>(Date.now())
  const lastJsonRef = useRef<string>('[]')

  // Track user interaction (passive, ref-only — no re-renders)
  useEffect(() => {
    const onInteraction = () => {
      lastInteractionRef.current = Date.now()
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const
    for (const event of events) {
      window.addEventListener(event, onInteraction, { passive: true })
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, onInteraction)
      }
    }
  }, [])

  const doHeartbeat = useCallback(async () => {
    try {
      const isActive = Date.now() - lastInteractionRef.current < ACTIVE_WINDOW
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (res.ok) {
        const data = await res.json()
        const json = JSON.stringify(data.onlineUsers || [])
        if (json !== lastJsonRef.current) {
          lastJsonRef.current = json
          setUsers(data.onlineUsers || [])
        }
      }
    } catch {
      // Silently fail — presence is best-effort
    }
  }, [])

  useEffect(() => {
    // Immediate heartbeat on mount
    doHeartbeat()

    // Recurring heartbeat
    const interval = setInterval(doHeartbeat, HEARTBEAT_INTERVAL)

    // Cleanup on unmount + beforeunload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable fire-and-forget on page close
      navigator.sendBeacon('/api/presence', new Blob([JSON.stringify({ clear: true })], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Fire-and-forget cleanup via fetch
      fetch('/api/presence', { method: 'DELETE', keepalive: true }).catch(() => {})
    }
  }, [doHeartbeat])

  return users
}
