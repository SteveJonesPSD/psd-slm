'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PresenceViewer } from '../../actions'

const HEARTBEAT_INTERVAL = 15_000 // 15 seconds

export function useTicketPresence(ticketId: string): PresenceViewer[] {
  const [viewers, setViewers] = useState<PresenceViewer[]>([])

  const doHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/helpdesk/ticket-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      })
      if (res.ok) {
        const data = await res.json()
        setViewers(data.viewers)
      }
    } catch {
      // Silently fail — presence is best-effort
    }
  }, [ticketId])

  const doClear = useCallback(() => {
    // Use sendBeacon for reliability on page unload, fall back to fetch
    const body = JSON.stringify({ ticketId })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/helpdesk/ticket-presence?_method=DELETE',
        new Blob([body], { type: 'application/json' })
      )
    } else {
      fetch('/api/helpdesk/ticket-presence', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  }, [ticketId])

  useEffect(() => {
    // Immediate heartbeat on mount
    doHeartbeat()

    // Recurring heartbeat
    const interval = setInterval(doHeartbeat, HEARTBEAT_INTERVAL)

    // Cleanup on unmount
    const handleBeforeUnload = () => {
      doClear()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      doClear() // fire-and-forget
    }
  }, [ticketId, doHeartbeat, doClear])

  return viewers
}
