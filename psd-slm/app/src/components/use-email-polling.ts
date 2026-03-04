'use client'

import { useEffect, useRef } from 'react'
import { backgroundPoll } from '@/lib/email/actions'

const POLL_INTERVAL = 60_000 // 60 seconds

export function useEmailPolling(enabled: boolean) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const poll = async () => {
      if (isPollingRef.current) return
      isPollingRef.current = true

      try {
        const result = await backgroundPoll()
        if (result.messagesProcessed && result.messagesProcessed > 0) {
          console.log(`[Email Poll] Processed ${result.messagesProcessed} messages`)
        }
      } catch (error) {
        console.error('[Email Poll] Error:', error)
      } finally {
        isPollingRef.current = false
      }
    }

    // Don't poll immediately on mount — wait for first interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled])
}
