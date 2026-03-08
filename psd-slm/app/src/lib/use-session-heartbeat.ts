'use client'
import { useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const

/**
 * Passive session heartbeat hook.
 * Tracks last user interaction via ref (no state — no re-renders).
 * Every 5 minutes, fires POST /api/session/heartbeat with activity status.
 * Mount once in the authenticated root layout.
 */
export function useSessionHeartbeat() {
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    )

    const interval = setInterval(async () => {
      const idleSinceMs = Date.now() - lastActivityRef.current
      const isActive = idleSinceMs < HEARTBEAT_INTERVAL_MS

      try {
        await fetch('/api/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive, idleMinutes: Math.floor(idleSinceMs / 60000) }),
        })
      } catch {
        // Heartbeat failure is non-critical
      }
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, handleActivity)
      )
    }
  }, [])
}
