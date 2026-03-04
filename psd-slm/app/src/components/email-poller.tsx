'use client'

import { useEmailPolling } from './use-email-polling'

export function EmailPoller({ enabled }: { enabled: boolean }) {
  useEmailPolling(enabled)
  return null
}
