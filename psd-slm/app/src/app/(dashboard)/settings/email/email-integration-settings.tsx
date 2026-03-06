'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MailConnection, MailChannel, MailProcessingLog } from '@/lib/email/types'
import { CHANNEL_STATUS, getChannelStatus } from '@/lib/email/types'
import { ConnectionForm } from './connection-form'
import { ChannelForm } from './channel-form'
import { ProcessingLogTable } from './processing-log'
import {
  deleteMailConnection,
  deleteMailChannel,
  toggleChannelActive,
  triggerPoll,
  clearProcessingLog,
  setAutoPollingEnabled,
  testConnectionFresh,
} from '@/lib/email/actions'

interface Props {
  connections: MailConnection[]
  channels: MailChannel[]
  processingLog: MailProcessingLog[]
  orgId: string
  autoPollingEnabled: boolean
}

export function EmailIntegrationSettings({ connections, channels, processingLog, orgId, autoPollingEnabled: initialAutoPolling }: Props) {
  const router = useRouter()
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<MailConnection | null>(null)
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<MailChannel | null>(null)
  const [polling, setPolling] = useState(false)
  const [pollResult, setPollResult] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [autoPoll, setAutoPoll] = useState(initialAutoPolling)
  const [togglingAutoPoll, setTogglingAutoPoll] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [reconnectResult, setReconnectResult] = useState<string | null>(null)

  const connection = connections[0] || null

  const handlePollNow = async () => {
    setPolling(true)
    setPollResult(null)
    const result = await triggerPoll()
    if (result.error) {
      setPollResult(`Error: ${result.error}`)
    } else {
      const results = result.results as { messagesProcessed?: number; messagesFound?: number }[] || []
      const totalProcessed = results.reduce((sum, r) => sum + (r.messagesProcessed || 0), 0)
      const totalFound = results.reduce((sum, r) => sum + (r.messagesFound || 0), 0)
      setPollResult(`Found ${totalFound} messages, processed ${totalProcessed}`)
    }
    setPolling(false)
    router.refresh()
  }

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Delete this connection? All channels using it will also be removed.')) return
    await deleteMailConnection(id)
    router.refresh()
  }

  const handleToggleChannel = async (id: string, active: boolean) => {
    await toggleChannelActive(id, active)
    router.refresh()
  }

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Delete this channel?')) return
    await deleteMailChannel(id)
    router.refresh()
  }

  const handleClearLog = async () => {
    if (!confirm('Clear all processing log entries?')) return
    await clearProcessingLog()
    router.refresh()
  }

  const handleToggleAutoPoll = async () => {
    setTogglingAutoPoll(true)
    const newValue = !autoPoll
    const result = await setAutoPollingEnabled(newValue)
    if (!result.error) {
      setAutoPoll(newValue)
      router.refresh()
    }
    setTogglingAutoPoll(false)
  }

  const handleReconnect = async () => {
    if (!connection) return
    setReconnecting(true)
    setReconnectResult(null)
    const result = await testConnectionFresh(connection.id)
    if (result.success) {
      setReconnectResult(`Connected successfully${result.displayName ? ` — ${result.displayName}` : ''}`)
    } else {
      setReconnectResult(`Error: ${result.error}`)
    }
    setReconnecting(false)
  }

  return (
    <div className="space-y-8">
      {/* Connection Card */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mail Connection</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Azure AD app credentials for Microsoft Graph API</p>
          </div>
          {!connection && (
            <Button
              variant="primary"
              onClick={() => { setEditingConnection(null); setShowConnectionForm(true) }}
            >
              Configure
            </Button>
          )}
        </div>

        {connection ? (
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{connection.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tenant: {connection.tenant_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Client ID: <code className="rounded bg-slate-100 dark:bg-slate-700 px-1">{connection.client_id}</code></span>
                  <span>Secret: <code className="rounded bg-slate-100 dark:bg-slate-700 px-1">{connection.client_secret}</code></span>
                </div>

                {connection.last_token_at && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Last token: {new Date(connection.last_token_at).toLocaleString('en-GB')}
                  </p>
                )}
                {connection.last_error && (
                  <p className="text-xs text-red-600 dark:text-red-400">Error: {connection.last_error}</p>
                )}
                {reconnectResult && (
                  <p className={`text-xs ${reconnectResult.startsWith('Error') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {reconnectResult}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={reconnecting}
                  className="rounded-lg border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50"
                >
                  {reconnecting ? 'Testing...' : 'Reconnect'}
                </button>
                <button
                  onClick={() => { setEditingConnection(connection); setShowConnectionForm(true) }}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteConnection(connection.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No mail connection configured. Click "Configure" to set up Azure AD credentials.
          </div>
        )}
      </div>

      {/* Channels Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mail Channels</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Mailbox addresses mapped to module handlers</p>
          </div>
          <div className="flex items-center gap-2">
            {channels.length > 0 && (
              <Button
                variant="primary"
                onClick={handlePollNow}
                disabled={polling}
              >
                {polling ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>
                    Polling...
                  </span>
                ) : 'Poll Now'}
              </Button>
            )}
            {connection && (
              <Button
                variant="primary"
                onClick={() => { setEditingChannel(null); setShowChannelForm(true) }}
              >
                Add Channel
              </Button>
            )}
          </div>
        </div>

        {/* Auto-Poll Toggle */}
        {connection && channels.length > 0 && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Auto-poll when Engage is open</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Checks for new emails every 60 seconds while any team member has Engage open</p>
            </div>
            <button
              onClick={handleToggleAutoPoll}
              disabled={togglingAutoPoll}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                autoPoll ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              role="switch"
              aria-checked={autoPoll}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                  autoPoll ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {pollResult && (
          <div className={`mx-6 mt-4 rounded-lg border px-4 py-2.5 text-sm ${
            pollResult.startsWith('Error') ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
          }`}>
            {pollResult}
          </div>
        )}

        {channels.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-6 py-3">Mailbox</th>
                  <th className="px-4 py-3">Handler</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Poll</th>
                  <th className="px-4 py-3">Errors</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(ch => {
                  const status = getChannelStatus(ch)
                  const statusCfg = CHANNEL_STATUS[status]
                  return (
                    <tr key={ch.id} className="border-b border-gray-50 dark:border-slate-700/50">
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{ch.mailbox_address}</p>
                          {ch.display_name && <p className="text-xs text-slate-500 dark:text-slate-400">{ch.display_name}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={ch.handler.charAt(0).toUpperCase() + ch.handler.slice(1)} color="#6366f1" bg="#eef2ff" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {ch.last_poll_at ? new Date(ch.last_poll_at).toLocaleString('en-GB') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {ch.error_count > 0 ? (
                          <span className="text-red-600 dark:text-red-400" title={ch.last_error || ''}>{ch.error_count} consecutive</span>
                        ) : '0'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleChannel(ch.id, !ch.is_active)}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            {ch.is_active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => { setEditingChannel(ch); setShowChannelForm(true) }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(ch.id)}
                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
            {connection
              ? 'No channels configured. Add a channel to start routing emails.'
              : 'Configure a mail connection first, then add channels.'}
          </div>
        )}
      </div>

      {/* Processing Log */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <button
          onClick={() => setShowLog(!showLog)}
          className="flex w-full items-center justify-between border-b border-gray-100 dark:border-slate-700 px-6 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Processing Log</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Last {processingLog.length} poll cycles</p>
          </div>
          <svg className={`h-5 w-5 text-slate-400 transition-transform ${showLog ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLog && (
          <div>
            {processingLog.length > 0 ? (
              <>
                <ProcessingLogTable entries={processingLog} />
                <div className="border-t border-gray-100 dark:border-slate-700 px-6 py-3 text-right">
                  <button
                    onClick={handleClearLog}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Clear Log
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                No processing log entries yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cron Setup Help */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-6">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Scheduler Setup</h3>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          To enable automatic polling, set up a cron job to POST to the poll endpoint every 60 seconds:
        </p>
        <div className="mt-3 rounded-lg bg-amber-100 dark:bg-amber-900/40 p-3">
          <code className="block text-[11px] text-amber-900 dark:text-amber-200 break-all">
            curl -s -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/email/poll -H &quot;Content-Type: application/json&quot; -H &quot;Authorization: Bearer YOUR_POLL_SECRET&quot; -d &apos;{`{"orgId":"${orgId}"}`}&apos;
          </code>
        </div>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Set the poll secret in Settings → API Keys or use the &quot;Poll Now&quot; button for manual polling.
        </p>
      </div>

      {/* Modals */}
      {showConnectionForm && (
        <ConnectionForm
          connection={editingConnection}
          onClose={() => setShowConnectionForm(false)}
          onSaved={() => { setShowConnectionForm(false); router.refresh() }}
        />
      )}

      {showChannelForm && connection && (
        <ChannelForm
          channel={editingChannel}
          connectionId={connection.id}
          onClose={() => setShowChannelForm(false)}
          onSaved={() => { setShowChannelForm(false); router.refresh() }}
        />
      )}
    </div>
  )
}
