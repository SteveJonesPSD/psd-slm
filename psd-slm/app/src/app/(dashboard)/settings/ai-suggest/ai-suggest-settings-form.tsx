'use client'

import { useState } from 'react'
import { Select, Textarea } from '@/components/ui/form-fields'
import { saveSettings } from '../actions'

interface Props {
  initialSettings: Record<string, string>
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'empathetic', label: 'Empathetic' },
]

const FORMALITY_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'semi_formal', label: 'Semi-formal' },
  { value: 'casual', label: 'Casual' },
]

const SLA_MENTION_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'when_relevant', label: 'When relevant' },
  { value: 'never', label: 'Never' },
]

const MAX_LENGTH_OPTIONS = [
  { value: 'brief', label: 'Brief (2-3 sentences)' },
  { value: 'medium', label: 'Medium (1-2 paragraphs)' },
  { value: 'detailed', label: 'Detailed' },
]

const CLARIFICATION_OPTIONS = [
  { value: 'always_draft', label: 'Always draft first' },
  { value: 'ask_if_low_detail', label: 'Ask if low detail' },
  { value: 'never_ask', label: 'Never ask' },
]

export function AiSuggestSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState({
    ai_suggest_tone: initialSettings.ai_suggest_tone || 'professional',
    ai_suggest_formality: initialSettings.ai_suggest_formality || 'formal',
    ai_suggest_mention_sla: initialSettings.ai_suggest_mention_sla || 'when_relevant',
    ai_suggest_max_length: initialSettings.ai_suggest_max_length || 'medium',
    ai_suggest_clarification: initialSettings.ai_suggest_clarification || 'ask_if_low_detail',
    ai_suggest_custom_instructions: initialSettings.ai_suggest_custom_instructions || '',
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
        category: 'ai_suggest',
        setting_key: key,
        setting_value: value,
      }))
    )

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'AI Suggest settings saved successfully.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Response Style */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Response Style</h3>
          <p className="mt-1 text-xs text-slate-500">
            These defaults apply to all agents unless they set personal overrides in their profile.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tone"
              value={settings.ai_suggest_tone}
              onChange={(v) => update('ai_suggest_tone', v)}
              options={TONE_OPTIONS}
            />
            <Select
              label="Formality"
              value={settings.ai_suggest_formality}
              onChange={(v) => update('ai_suggest_formality', v)}
              options={FORMALITY_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Mention SLA Deadlines"
              value={settings.ai_suggest_mention_sla}
              onChange={(v) => update('ai_suggest_mention_sla', v)}
              options={SLA_MENTION_OPTIONS}
            />
            <Select
              label="Response Length"
              value={settings.ai_suggest_max_length}
              onChange={(v) => update('ai_suggest_max_length', v)}
              options={MAX_LENGTH_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* Behaviour */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Behaviour</h3>
        </div>
        <div className="space-y-4 p-6">
          <Select
            label="Clarification Behaviour"
            value={settings.ai_suggest_clarification}
            onChange={(v) => update('ai_suggest_clarification', v)}
            options={CLARIFICATION_OPTIONS}
          />
          <p className="text-xs text-slate-500">
            Controls whether AI drafts a response immediately or asks the agent clarifying questions first.
            &quot;Always draft first&quot; is recommended for experienced teams.
          </p>
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Custom Instructions</h3>
          <p className="mt-1 text-xs text-slate-500">
            Additional guidelines appended to every AI prompt. Use for org-specific rules
            (e.g. &quot;always mention our 24/7 emergency line&quot;, &quot;never promise same-day resolution&quot;).
          </p>
        </div>
        <div className="p-6">
          <Textarea
            label="Organisation Guidelines"
            value={settings.ai_suggest_custom_instructions}
            onChange={(v) => update('ai_suggest_custom_instructions', v)}
            rows={5}
            placeholder="e.g. Always include our support email: support@psdgroup.co.uk"
          />
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
