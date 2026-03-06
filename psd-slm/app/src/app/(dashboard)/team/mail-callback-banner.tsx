'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  error?: string
  connected?: boolean
  email?: string
}

export function MailCallbackBanner({ error, connected, email }: Props) {
  const router = useRouter()
  const [visible, setVisible] = useState(!!error || !!connected)

  useEffect(() => {
    if (!error && !connected) return
    // Re-fetch server component data (mailCredentials), then clean query params
    router.refresh()
    const timer = setTimeout(() => {
      router.replace('/team', { scroll: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [error, connected, router])

  if (!visible) return null

  if (error) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        <span>Mailbox connection failed: {error}</span>
        <button onClick={() => setVisible(false)} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">&times;</button>
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
      <span>Mailbox connected successfully{email ? `: ${email}` : ''}</span>
      <button onClick={() => setVisible(false)} className="ml-3 text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300">&times;</button>
    </div>
  )
}
