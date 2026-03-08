'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveXeroSettings, testXeroConnection } from '@/lib/xero/xero-actions'

interface XeroSettingsFormProps {
  settings: {
    enabled: boolean
    push_mode: 'auto' | 'manual'
    credentials: {
      client_id: string
      client_secret: string
      tenant_id: string
    }
    is_configured: boolean
  }
  stats: {
    synced: number
    failed: number
    notPushed: number
    lastPushedAt: string | null
  }
}

export function XeroSettingsForm({ settings, stats }: XeroSettingsFormProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [pushMode, setPushMode] = useState<'auto' | 'manual'>(settings.push_mode)
  const [clientId, setClientId] = useState(settings.credentials.client_id)
  const [clientSecret, setClientSecret] = useState(settings.credentials.client_secret)
  const [tenantId, setTenantId] = useState(settings.credentials.tenant_id)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; org_name?: string; error?: string } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const isMasked = clientSecret.startsWith('\u2022')
      const result = await testXeroConnection(
        isMasked ? undefined : { client_id: clientId, client_secret: clientSecret, tenant_id: tenantId }
      )
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: String(err) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveXeroSettings({
        enabled,
        push_mode: pushMode,
        client_id: clientId,
        client_secret: clientSecret,
        tenant_id: tenantId,
      })
      if ('error' in result) {
        showToast(`Error: ${result.error}`)
      } else {
        showToast('Xero settings saved')
        router.refresh()
      }
    } catch (err) {
      showToast(`Error: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className={`rounded-lg p-3 text-sm ${
          toast.startsWith('Error') ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        }`}>
          {toast}
        </div>
      )}

      {/* Enable/Disable */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Enable Xero Sync</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              When enabled, invoices can be pushed to Xero for accounting
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Connection */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-4">Connection</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="From your Xero app registration"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Client Secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={settings.is_configured ? 'Leave blank to keep existing' : 'From your Xero app registration'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tenant ID</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Find this in Xero under Settings > Connected Apps"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="default"
              onClick={handleTest}
              disabled={testing || (!clientId && !settings.is_configured)}
            >
              {testing ? 'Testing\u2026' : 'Test Connection'}
            </Button>
            {testResult && (
              <span className={`text-sm font-medium ${
                testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {testResult.success
                  ? `Connected${testResult.org_name ? ` to ${testResult.org_name}` : ''}`
                  : testResult.error || 'Connection failed'
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-4">Push Mode</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setPushMode('manual')}
            className={`text-left rounded-lg border-2 p-4 transition-colors ${
              pushMode === 'manual'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Manual</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Select invoices and push in batches from the invoices list
            </div>
          </button>
          <button
            onClick={() => setPushMode('auto')}
            className={`text-left rounded-lg border-2 p-4 transition-colors ${
              pushMode === 'auto'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Automatic</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Invoices are automatically pushed to Xero when marked as Sent
            </div>
          </button>
        </div>
      </div>

      {/* Status */}
      {settings.is_configured && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-4">Sync Status</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Synced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{stats.notPushed}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Not Pushed</div>
            </div>
          </div>
          {stats.lastPushedAt && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Last push: {formatDate(stats.lastPushedAt)}
            </p>
          )}
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button
          size="md"
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving\u2026' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
