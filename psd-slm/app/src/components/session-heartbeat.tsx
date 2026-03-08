'use client'

import { useSessionHeartbeat } from '@/lib/use-session-heartbeat'

export function SessionHeartbeat() {
  useSessionHeartbeat()
  return null
}
