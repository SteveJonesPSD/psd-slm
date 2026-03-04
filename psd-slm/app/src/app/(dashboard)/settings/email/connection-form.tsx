'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/form-fields'
import { saveMailConnection } from '@/lib/email/actions'
import type { MailConnection } from '@/lib/email/types'

interface Props {
  connection: MailConnection | null
  onClose: () => void
  onSaved: () => void
}

export function ConnectionForm({ connection, onClose, onSaved }: Props) {
  const [tenantId, setTenantId] = useState(connection?.tenant_id || '')
  const [clientId, setClientId] = useState(connection?.client_id || '')
  // Never populate secret from saved connection — it's masked server-side
  const [clientSecret, setClientSecret] = useState('')
  const [name, setName] = useState(connection?.name || 'Microsoft 365')
  const [testMailbox, setTestMailbox] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    if (!tenantId || !clientId || !testMailbox) {
      setTestResult({ success: false, message: 'Fill in all fields and provide a mailbox address to test' })
      return
    }

    // For saved connections with no new secret entered, test using DB credentials
    if (!clientSecret && !connection?.id) {
      setTestResult({ success: false, message: 'Enter the client secret to test' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const payload: Record<string, string> = { tenantId, clientId, mailbox: testMailbox }

      if (connection?.id && !clientSecret) {
        // Use saved credentials from DB
        payload.connectionId = connection.id
      } else {
        // Use the secret entered in the form
        payload.clientSecret = clientSecret
      }

      const res = await fetch('/api/email/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.success) {
        setTestResult({ success: true, message: `Connected successfully! Mailbox: ${data.displayName}` })
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' })
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' })
    }

    setTesting(false)
  }

  const handleSave = async () => {
    if (!tenantId || !clientId) {
      setError('Tenant ID and Client ID are required')
      return
    }
    if (!connection && !clientSecret) {
      setError('Client Secret is required for new connections')
      return
    }

    setSaving(true)
    setError(null)

    const result = await saveMailConnection(
      { tenant_id: tenantId, client_id: clientId, client_secret: clientSecret, name },
      connection?.id
    )

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {connection ? 'Edit Mail Connection' : 'Configure Mail Connection'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Azure AD app registration credentials for Microsoft Graph API access
          </p>
        </div>

        <div className="space-y-4 p-6">
          <Input
            label="Connection Name"
            value={name}
            onChange={setName}
            placeholder="Microsoft 365"
          />
          <Input
            label="Tenant ID"
            value={tenantId}
            onChange={setTenantId}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          <Input
            label="Client ID"
            value={clientId}
            onChange={setClientId}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          <div>
            <Input
              label="Client Secret"
              value={clientSecret}
              onChange={setClientSecret}
              placeholder={connection ? '(saved — enter new value to replace)' : 'Enter client secret'}
              type="password"
            />
            {connection && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Leave blank to keep the existing secret</p>
            )}
          </div>

          {/* Test Connection */}
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-600 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Test Connection</p>
            <div className="flex items-end gap-3">
              <Input
                label="Mailbox Address"
                value={testMailbox}
                onChange={setTestMailbox}
                placeholder="devhelpdesk@psdgroup.co.uk"
                className="flex-1"
              />
              <button
                onClick={handleTest}
                disabled={testing}
                className="shrink-0 rounded-lg border border-indigo-200 dark:border-indigo-800 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {testResult.success ? (
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                <span className="text-xs">{testResult.message}</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Connection'}
          </button>
        </div>
      </div>
    </div>
  )
}
