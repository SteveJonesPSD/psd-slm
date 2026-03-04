'use client'

import { useState } from 'react'
import { Select, Textarea } from '@/components/ui/form-fields'
import { saveMyAiPreferences } from './actions'

interface Props {
  initialPreferences: Record<string, string>
}

const TONE_OPTIONS = [
  { value: '', label: 'Use global default' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'empathetic', label: 'Empathetic' },
]

const FORMALITY_OPTIONS = [
  { value: '', label: 'Use global default' },
  { value: 'formal', label: 'Formal' },
  { value: 'semi_formal', label: 'Semi-formal' },
  { value: 'casual', label: 'Casual' },
]

export function AiPreferencesForm({ initialPreferences }: Props) {
  const [prefs, setPrefs] = useState({
    tone_override: initialPreferences.tone_override || '',
    formality_override: initialPreferences.formality_override || '',
    signature: initialPreferences.signature || '',
    writing_style_notes: initialPreferences.writing_style_notes || '',
    phrases_to_use: initialPreferences.phrases_to_use || '',
    phrases_to_avoid: initialPreferences.phrases_to_avoid || '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const update = (key: string, value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const result = await saveMyAiPreferences(prefs)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Preferences saved successfully.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Style Overrides */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">AI Response Style</h3>
          <p className="mt-1 text-xs text-slate-500">
            Override the organisation defaults so AI suggestions match your personal writing style.
            Leave as &quot;Use global default&quot; to inherit the org setting.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tone"
              value={prefs.tone_override}
              onChange={(v) => update('tone_override', v)}
              options={TONE_OPTIONS}
            />
            <Select
              label="Formality"
              value={prefs.formality_override}
              onChange={(v) => update('formality_override', v)}
              options={FORMALITY_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* Personal Writing Style */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Personal Writing Style</h3>
          <p className="mt-1 text-xs text-slate-500">
            Help the AI match how you naturally write so suggestions need less editing.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <Textarea
            label="Signature / Sign-off"
            value={prefs.signature}
            onChange={(v) => update('signature', v)}
            rows={3}
            placeholder={"e.g. Kind regards,\nSteve"}
          />
          <Textarea
            label="Writing Style Notes"
            value={prefs.writing_style_notes}
            onChange={(v) => update('writing_style_notes', v)}
            rows={3}
            placeholder="e.g. Direct but warm, use bullet points for technical steps"
          />
          <div className="grid grid-cols-2 gap-4">
            <Textarea
              label="Phrases to Use"
              value={prefs.phrases_to_use}
              onChange={(v) => update('phrases_to_use', v)}
              rows={3}
              placeholder={"e.g. Happy to help\nI'll get this sorted for you"}
            />
            <Textarea
              label="Phrases to Avoid"
              value={prefs.phrases_to_avoid}
              onChange={(v) => update('phrases_to_avoid', v)}
              rows={3}
              placeholder={"e.g. Please do not hesitate\nAs per my last email"}
            />
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
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
