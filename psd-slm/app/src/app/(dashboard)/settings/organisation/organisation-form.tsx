'use client'

import { useState } from 'react'
import { Input, Select } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { saveSettings } from '../actions'

interface OrganisationFormProps {
  initialSettings: Record<string, string>
}

const TIMEZONE_OPTIONS = [
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'USD', label: 'USD - US Dollar' },
]

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((m) => ({ value: m, label: m }))

export function OrganisationForm({ initialSettings }: OrganisationFormProps) {
  const [settings, setSettings] = useState({
    org_name: initialSettings.org_name || 'PSD Group',
    timezone: initialSettings.timezone || 'Europe/London',
    date_format: initialSettings.date_format || 'DD/MM/YYYY',
    currency: initialSettings.currency || 'GBP',
    financial_year_start: initialSettings.financial_year_start || 'April',
    default_vat_rate: initialSettings.default_vat_rate || '20',
    default_payment_terms: initialSettings.default_payment_terms || '30',
    quote_validity_days: initialSettings.quote_validity_days || '14',
    margin_threshold_green: initialSettings.margin_threshold_green || '30',
    margin_threshold_amber: initialSettings.margin_threshold_amber || '15',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const result = await saveSettings(
      Object.entries(settings).map(([key, value]) => ({
        category: 'general',
        setting_key: key,
        setting_value: value,
      }))
    )

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully.' })
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="space-y-6 p-6">
        <Input
          label="Organisation Name"
          value={settings.org_name}
          onChange={(v) => update('org_name', v)}
          placeholder="PSD Group"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Timezone"
            value={settings.timezone}
            onChange={(v) => update('timezone', v)}
            options={TIMEZONE_OPTIONS}
          />
          <Select
            label="Date Format"
            value={settings.date_format}
            onChange={(v) => update('date_format', v)}
            options={DATE_FORMAT_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Currency"
            value={settings.currency}
            onChange={(v) => update('currency', v)}
            options={CURRENCY_OPTIONS}
          />
          <Select
            label="Financial Year Start"
            value={settings.financial_year_start}
            onChange={(v) => update('financial_year_start', v)}
            options={MONTH_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Default VAT Rate (%)"
            type="number"
            value={settings.default_vat_rate}
            onChange={(v) => update('default_vat_rate', v)}
            min="0"
            max="100"
            step="0.5"
          />
          <Input
            label="Default Payment Terms (days)"
            type="number"
            value={settings.default_payment_terms}
            onChange={(v) => update('default_payment_terms', v)}
            min="0"
            step="1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quote Validity (business days)"
            type="number"
            value={settings.quote_validity_days}
            onChange={(v) => update('quote_validity_days', v)}
            min="1"
            step="1"
          />
        </div>

        <div className="border-t border-gray-100 pt-6 mt-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Margin Colour Thresholds</h3>
          <p className="text-xs text-slate-500 mb-4">
            Margins at or above <span className="text-emerald-600 font-medium">green</span> show green,
            at or above <span className="text-amber-600 font-medium">amber</span> show amber,
            below amber show <span className="text-red-600 font-medium">red</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Green Threshold (%)"
              type="number"
              value={settings.margin_threshold_green}
              onChange={(v) => update('margin_threshold_green', v)}
              min="0"
              max="100"
              step="1"
            />
            <Input
              label="Amber Threshold (%)"
              type="number"
              value={settings.margin_threshold_amber}
              onChange={(v) => update('margin_threshold_amber', v)}
              min="0"
              max="100"
              step="1"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
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
