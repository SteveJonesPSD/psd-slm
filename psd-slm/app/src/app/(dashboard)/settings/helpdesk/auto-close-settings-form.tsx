'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { saveSettings } from '../actions'

interface Props {
  initialSettings: Record<string, string>
}

function Toggle({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export function AutoCloseSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState({
    auto_close_enabled: initialSettings.auto_close_enabled || 'true',
    auto_close_hours: initialSettings.auto_close_hours || '48',
    auto_close_warning_hours: initialSettings.auto_close_warning_hours || '24',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const isEnabled = settings.auto_close_enabled === 'true'

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const result = await saveSettings(
      Object.entries(settings).map(([key, value]) => ({
        category: 'helpdesk',
        setting_key: key,
        setting_value: value,
      }))
    )

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Auto-close settings saved successfully.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Master Switch */}
      <div className={`rounded-xl border-2 ${isEnabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
        <div className="px-6 py-5">
          <Toggle
            label="Enable Auto-Close"
            description="Automatically close tickets in 'waiting on customer' status after a configurable number of business hours without a customer response."
            checked={isEnabled}
            onChange={() => update('auto_close_enabled', isEnabled ? 'false' : 'true')}
          />
        </div>
      </div>

      {isEnabled && (
        <>
          {/* Timing */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Timing</h3>
              <p className="mt-1 text-xs text-slate-500">
                Configure when tickets auto-close and when warnings are sent. All values are in business hours (Mon-Fri, 08:00–17:30).
              </p>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Close after (business hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={settings.auto_close_hours}
                  onChange={(e) => update('auto_close_hours', e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Tickets waiting on customer for this many business hours will be automatically closed. Default: 48 hours (approx. 5 working days).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Warning before close (business hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={settings.auto_close_warning_hours}
                  onChange={(e) => update('auto_close_warning_hours', e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  An internal warning message is added to the ticket this many business hours before auto-close. Warnings are only sent if the remaining time falls entirely within business days (no weekend gap). Default: 24 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">How it works</h4>
            <ul className="space-y-1.5 text-xs text-slate-500">
              <li>When an agent sends a customer-facing reply, the ticket status changes to &ldquo;Waiting on Customer&rdquo; and the countdown begins.</li>
              <li>If the customer replies, the countdown resets.</li>
              <li>If no response arrives within the configured business hours, the ticket is automatically closed with a system message.</li>
              <li>Use the &ldquo;Hold Open&rdquo; toggle on individual tickets to exempt them from auto-close.</li>
              <li>Auto-close processing runs whenever an agent visits the helpdesk queue — no cron job required.</li>
            </ul>
          </div>
        </>
      )}

      {/* Save */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
