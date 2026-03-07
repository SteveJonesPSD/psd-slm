'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { usePushNotifications } from '@/components/use-push-notifications'
import { saveMyNotificationPreferences } from './actions'

const NOTIFICATION_TYPES = [
  { key: 'quote_accepted', label: 'Quote accepted', group: 'Quotes' },
  { key: 'quote_declined', label: 'Quote declined', group: 'Quotes' },
  { key: 'change_request', label: 'Quote change request', group: 'Quotes' },
  { key: 'ticket_status_changed', label: 'Ticket status changed', group: 'Service Desk' },
  { key: 'ticket_assigned', label: 'Ticket assigned', group: 'Service Desk' },
  { key: 'ticket_reply', label: 'Ticket reply added', group: 'Service Desk' },
  { key: 'ticket_internal_note', label: 'Ticket internal note', group: 'Service Desk' },
  { key: 'inbound_po_matched', label: 'Customer PO matched', group: 'Purchasing' },
  { key: 'inbound_po_failed', label: 'Customer PO processing failed', group: 'Purchasing' },
  { key: 'helen_draft_ready', label: 'Helen AI draft ready', group: 'AI' },
]

interface NotificationPreferencesFormProps {
  initialPreferences: Record<string, any>
}

export function NotificationPreferencesForm({ initialPreferences }: NotificationPreferencesFormProps) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const { isSupported, isSubscribed, permission, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleTestPush() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setTestResult(JSON.stringify(data.debug, null, 2))
      } else {
        setTestResult(`Error: ${JSON.stringify(data)}`)
      }
    } catch (err: any) {
      setTestResult(`Error: ${err?.message || 'Failed'}`)
    }
    setTesting(false)
  }

  // Push preferences: which types are enabled (default all true)
  const pushPrefs = (initialPreferences.push as Record<string, boolean>) || {}
  const [typePrefs, setTypePrefs] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {}
    for (const t of NOTIFICATION_TYPES) {
      result[t.key] = pushPrefs[t.key] !== false
    }
    return result
  })

  function handleToggle(key: string) {
    setTypePrefs(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(false)
    startTransition(async () => {
      const res = await saveMyNotificationPreferences({
        ...initialPreferences,
        push: typePrefs,
      })
      if (res.success) setSaved(true)
    })
  }

  // Group notification types
  const groups = NOTIFICATION_TYPES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = []
    acc[t.group].push(t)
    return acc
  }, {} as Record<string, typeof NOTIFICATION_TYPES>)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="border-b border-gray-200 dark:border-slate-700 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Push Notifications</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Receive Chrome browser notifications for events that matter to you
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Push subscription toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Browser notifications</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {!isSupported
                ? 'Not supported in this browser'
                : permission === 'denied'
                  ? 'Notifications blocked — enable in browser settings'
                  : isSubscribed
                    ? 'Enabled — you will receive push notifications'
                    : 'Disabled — click Enable to receive push notifications'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSupported && permission !== 'denied' && (
              <Button
                size="sm"
                variant={isSubscribed ? 'danger' : 'success'}
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
              >
                {pushLoading ? 'Working...' : isSubscribed ? 'Disable' : 'Enable'}
              </Button>
            )}
            {isSubscribed && (
              <Button size="sm" variant="default" onClick={handleTestPush} disabled={testing}>
                {testing ? 'Sending...' : 'Test'}
              </Button>
            )}
          </div>
        </div>

        {testResult && (
          <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded overflow-auto max-h-48 text-slate-700 dark:text-slate-300">
            {testResult}
          </pre>
        )}

        {/* Per-type toggles (only show when subscribed) */}
        {isSubscribed && (
          <div className="space-y-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Choose which notifications trigger a push
            </div>

            {Object.entries(groups).map(([group, types]) => (
              <div key={group}>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">{group}</div>
                <div className="space-y-1.5">
                  {types.map(t => (
                    <label key={t.key} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typePrefs[t.key]}
                        onChange={() => handleToggle(t.key)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <Button size="sm" variant="primary" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
              {saved && <span className="text-xs text-green-600">Saved</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
