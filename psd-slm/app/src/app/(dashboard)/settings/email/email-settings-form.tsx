'use client'

import { useState } from 'react'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { saveSettings } from '../actions'

interface Props {
  initialSettings: Record<string, string>
}

const PROVIDER_OPTIONS = [
  { value: 'none', label: 'None (disabled)' },
  { value: 'resend', label: 'Resend' },
  { value: 'postmark', label: 'Postmark' },
  { value: 'smtp', label: 'SMTP' },
]

const SAMPLE_DATA: Record<string, string> = {
  '{contact_name}': 'Jane Smith',
  '{company_name}': 'Acme Corporation',
  '{quote_number}': 'Q-2026-0042',
  '{brand_name}': 'PSD Group',
  '{portal_url}': 'https://engage.psdgroup.co.uk/q/abc123',
  '{valid_until}': '31 Mar 2026',
}

export function EmailSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState({
    email_provider: initialSettings.email_provider || 'none',
    email_from_address: initialSettings.email_from_address || '',
    email_from_name: initialSettings.email_from_name || '',
    email_reply_to: initialSettings.email_reply_to || '',
    email_bcc: initialSettings.email_bcc || '',
    quote_email_subject: initialSettings.quote_email_subject || 'Quote {quote_number} from {brand_name}',
    quote_email_body: initialSettings.quote_email_body || 'Dear {contact_name},\n\nPlease find attached our quote {quote_number} for your review.\n\nYou can also view and accept this quote online:\n{portal_url}\n\nThis quote is valid until {valid_until}.\n\nIf you have any questions, please don\'t hesitate to get in touch.\n\nKind regards,\n{brand_name}',
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
        category: 'email',
        setting_key: key,
        setting_value: value,
      }))
    )

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Email settings saved successfully.' })
    }
    setSaving(false)
  }

  // Apply sample data to preview
  const previewSubject = replacePlaceholders(settings.quote_email_subject)
  const previewBody = replacePlaceholders(settings.quote_email_body)

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Delivery Configuration</h3>
        </div>
        <div className="space-y-4 p-6">
          <Select
            label="Email Provider"
            value={settings.email_provider}
            onChange={(v) => update('email_provider', v)}
            options={PROVIDER_OPTIONS}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default From Address"
              type="email"
              value={settings.email_from_address}
              onChange={(v) => update('email_from_address', v)}
              placeholder="quotes@psdgroup.co.uk"
            />
            <Input
              label="Default From Name"
              value={settings.email_from_name}
              onChange={(v) => update('email_from_name', v)}
              placeholder="PSD Group"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Reply-To Address"
              type="email"
              value={settings.email_reply_to}
              onChange={(v) => update('email_reply_to', v)}
              placeholder="sales@psdgroup.co.uk"
            />
            <Input
              label="BCC Address (optional)"
              type="email"
              value={settings.email_bcc}
              onChange={(v) => update('email_bcc', v)}
              placeholder="archive@psdgroup.co.uk"
            />
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Quote Email Template</h3>
          <p className="mt-1 text-xs text-slate-500">
            Available placeholders: {Object.keys(SAMPLE_DATA).map((p) => (
              <code key={p} className="mx-0.5 rounded bg-slate-100 px-1 text-[10px]">{p}</code>
            ))}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <Input
              label="Subject Template"
              value={settings.quote_email_subject}
              onChange={(v) => update('quote_email_subject', v)}
            />
            <Textarea
              label="Body Template"
              value={settings.quote_email_body}
              onChange={(v) => update('quote_email_body', v)}
              rows={12}
            />
          </div>

          {/* Live Preview */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Preview</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 border-b border-slate-200 pb-3">
                <div className="text-xs text-slate-400">Subject</div>
                <div className="text-sm font-medium text-slate-800">{previewSubject}</div>
              </div>
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {previewBody}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function replacePlaceholders(template: string): string {
  let result = template
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
  }
  return result
}
