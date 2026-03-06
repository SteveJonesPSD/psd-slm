'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { saveSettings } from '../actions'

interface ApiKeyInfo {
  key: string
  label: string
  description: string
  testable: boolean
  placeholder: string
}

const API_KEYS: ApiKeyInfo[] = [
  {
    key: 'anthropic_api_key',
    label: 'Anthropic (Claude)',
    description: 'AI assistant for data queries and quote assistance',
    testable: true,
    placeholder: 'sk-ant-...',
  },
  {
    key: 'resend_api_key',
    label: 'Resend',
    description: 'Email delivery for sending quotes and notifications',
    testable: true,
    placeholder: 're_...',
  },
  {
    key: 'ideal_postcodes_api_key',
    label: 'Ideal Postcodes',
    description: 'UK postcode address lookup for customer forms',
    testable: true,
    placeholder: 'ak_...',
  },
  {
    key: 'halopsa_api_url',
    label: 'HaloPSA URL',
    description: 'Helpdesk/PSA integration base URL',
    testable: false,
    placeholder: 'https://your-instance.halopsa.com',
  },
  {
    key: 'halopsa_api_key',
    label: 'HaloPSA API Key',
    description: 'Helpdesk/PSA authentication',
    testable: false,
    placeholder: '',
  },
  {
    key: 'elevenlabs_api_key',
    label: 'ElevenLabs',
    description: 'Voice AI for phone-based ticket logging',
    testable: false,
    placeholder: '',
  },
]

interface Props {
  initialSettings: Record<string, { value: string | null; isSet: boolean }>
}

export function ApiKeysPanel({ initialSettings }: Props) {
  return (
    <div className="space-y-4">
      {API_KEYS.map((apiKey) => (
        <ApiKeyCard
          key={apiKey.key}
          info={apiKey}
          initialValue={initialSettings[apiKey.key]?.value || ''}
          isSet={initialSettings[apiKey.key]?.isSet || false}
        />
      ))}
    </div>
  )
}

function ApiKeyCard({
  info,
  initialValue,
  isSet,
}: {
  info: ApiKeyInfo
  initialValue: string
  isSet: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentIsSet, setCurrentIsSet] = useState(isSet)
  const [displayValue, setDisplayValue] = useState(initialValue)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    setMessage(null)

    const result = await saveSettings([
      {
        category: 'integrations',
        setting_key: info.key,
        setting_value: value.trim(),
        is_secret: true,
        description: info.description,
      },
    ])

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      // Mask the saved value for display
      const v = value.trim()
      const masked = v.length <= 11 ? '••••••••' : v.substring(0, 7) + '...' + v.substring(v.length - 4)
      setDisplayValue(masked)
      setCurrentIsSet(true)
      setEditing(false)
      setValue('')
      setMessage({ type: 'success', text: 'Key saved successfully.' })
    }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: info.key }),
      })
      const data = await res.json()
      setMessage({
        type: data.success ? 'success' : 'error',
        text: data.message,
      })
    } catch {
      setMessage({ type: 'error', text: 'Failed to test connection.' })
    }
    setTesting(false)
  }

  const handleClear = async () => {
    setSaving(true)
    setMessage(null)

    const result = await saveSettings([
      {
        category: 'integrations',
        setting_key: info.key,
        setting_value: '',
        is_secret: true,
        description: info.description,
      },
    ])

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setDisplayValue('')
      setCurrentIsSet(false)
      setEditing(false)
      setValue('')
      setMessage({ type: 'success', text: 'Key removed.' })
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{info.label}</h3>
            <p className="text-xs text-slate-500">{info.description}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            currentIsSet
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${currentIsSet ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {currentIsSet ? 'Connected' : 'Not Configured'}
        </span>
      </div>

      <div className="mt-4">
        {editing ? (
          <div className="space-y-3">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={info.placeholder || 'Enter API key...'}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 font-mono"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving || !value.trim()}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <button
                onClick={() => { setEditing(false); setValue(''); setMessage(null) }}
                className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {currentIsSet && (
              <code className="rounded bg-slate-50 px-2.5 py-1 text-xs text-slate-600 font-mono">
                {displayValue}
              </code>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              {currentIsSet ? 'Update' : 'Configure'}
            </button>
            {currentIsSet && info.testable && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            )}
            {currentIsSet && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <p className={`mt-3 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
