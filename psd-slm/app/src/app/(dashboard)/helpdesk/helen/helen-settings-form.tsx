'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/form-fields'
import { saveSettings } from '../../settings/actions'
import { getAutogrumpStats, clearAllToneScores } from '../actions'

interface Props {
  initialSettings: Record<string, string>
}

const DEFAULT_PERSONA = `You are Helen, a friendly and professional IT support assistant for PSD Group. You are knowledgeable about IT infrastructure, Microsoft 365, networking, and general IT support. You always aim to be helpful, clear, and reassuring.`

const DEFAULT_GUARDRAILS = `- Never promise specific resolution times or SLA guarantees
- Do not share internal pricing, contract details, or staff information
- Do not attempt to diagnose security incidents — escalate immediately
- Always recommend contacting PSD Support directly for urgent issues
- Do not make up technical solutions — only suggest well-known troubleshooting steps`

const DEFAULT_ACK_TEMPLATE = `Hi {contact_name},

Thank you for contacting PSD Group support. Your ticket {ticket_number} has been logged and our team will be in touch shortly.

Subject: {subject}
Priority: {priority}
Reference: {ticket_number}

Regards,
PSD Support`

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

export function HelenSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState({
    helen_enabled: initialSettings.helen_enabled || 'false',
    helen_persona: initialSettings.helen_persona || DEFAULT_PERSONA,
    helen_guardrails: initialSettings.helen_guardrails || DEFAULT_GUARDRAILS,
    helen_ack_enabled: initialSettings.helen_ack_enabled || 'true',
    helen_ack_template: initialSettings.helen_ack_template || DEFAULT_ACK_TEMPLATE,
    helen_draft_enabled: initialSettings.helen_draft_enabled || 'true',
    helen_auto_send_needs_detail: initialSettings.helen_auto_send_needs_detail || 'false',
    helen_create_tags: initialSettings.helen_create_tags || 'false',
    autogrump_enabled: initialSettings.autogrump_enabled || 'true',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [grumpStats, setGrumpStats] = useState<{ flagged: number } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    getAutogrumpStats().then(setGrumpStats).catch(() => {})
  }, [])

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const toggleBool = (key: string) => {
    const current = settings[key as keyof typeof settings]
    update(key, current === 'true' ? 'false' : 'true')
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const result = await saveSettings(
      Object.entries(settings).map(([key, value]) => ({
        category: 'helen',
        setting_key: key,
        setting_value: value,
      }))
    )

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Helen AI settings saved successfully.' })
    }
    setSaving(false)
  }

  const isEnabled = settings.helen_enabled === 'true'

  return (
    <div className="space-y-6">
      {/* Master Switch */}
      <div className={`rounded-xl border-2 ${isEnabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
        <div className="px-6 py-5">
          <Toggle
            label="Enable Helen AI Agent"
            description="When enabled, Helen will automatically process new tickets — acknowledging, triaging, and drafting responses."
            checked={isEnabled}
            onChange={() => toggleBool('helen_enabled')}
          />
        </div>
      </div>

      {isEnabled && (
        <>
          {/* Persona */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Persona</h3>
              <p className="mt-1 text-xs text-slate-500">
                Define who Helen is — her personality, tone, and expertise. This shapes how she communicates.
              </p>
            </div>
            <div className="p-6">
              <Textarea
                label="Persona"
                value={settings.helen_persona}
                onChange={(v) => update('helen_persona', v)}
                rows={5}
                placeholder="Describe Helen's personality and communication style..."
              />
            </div>
          </div>

          {/* Guardrails */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Guardrails</h3>
              <p className="mt-1 text-xs text-slate-500">
                Set boundaries and restrictions. These rules prevent Helen from saying things she shouldn&apos;t.
              </p>
            </div>
            <div className="p-6">
              <Textarea
                label="Guardrails"
                value={settings.helen_guardrails}
                onChange={(v) => update('helen_guardrails', v)}
                rows={6}
                placeholder="List restrictions, one per line..."
              />
            </div>
          </div>

          {/* Acknowledgement */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Auto-Acknowledgement</h3>
              <p className="mt-1 text-xs text-slate-500">
                Send an immediate acknowledgement message when a ticket is created.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Toggle
                label="Send acknowledgement"
                description="Automatically sends a system message confirming the ticket has been received."
                checked={settings.helen_ack_enabled === 'true'}
                onChange={() => toggleBool('helen_ack_enabled')}
              />
              {settings.helen_ack_enabled === 'true' && (
                <>
                  <Textarea
                    label="Acknowledgement Template"
                    value={settings.helen_ack_template}
                    onChange={(v) => update('helen_ack_template', v)}
                    rows={8}
                    placeholder="Enter acknowledgement message template..."
                  />
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">Available Placeholders</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-500">
                      <span><code className="rounded bg-slate-200 px-1">{'{ticket_number}'}</code> — Ticket reference</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{customer_name}'}</code> — Company name</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{contact_name}'}</code> — Contact first name</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{subject}'}</code> — Ticket subject</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{priority}'}</code> — Priority level</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{category}'}</code> — Ticket category</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{sla_response_due}'}</code> — SLA response deadline</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Draft Responses */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Draft Responses</h3>
              <p className="mt-1 text-xs text-slate-500">
                Helen analyses tickets and drafts initial responses for agent approval.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Toggle
                label="Enable draft responses"
                description="Helen will draft an initial response for each ticket, queued for agent review before sending."
                checked={settings.helen_draft_enabled === 'true'}
                onChange={() => toggleBool('helen_draft_enabled')}
              />
              {settings.helen_draft_enabled === 'true' && (
                <Toggle
                  label="Auto-send &quot;needs detail&quot; responses"
                  description="When Helen detects missing information, automatically send the request for detail without waiting for agent approval. Other draft types still require approval."
                  checked={settings.helen_auto_send_needs_detail === 'true'}
                  onChange={() => toggleBool('helen_auto_send_needs_detail')}
                />
              )}
            </div>
          </div>

          {/* Tag Creation */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Tag Management</h3>
              <p className="mt-1 text-xs text-slate-500">
                Control whether Helen can create new tags when no existing ones fit.
              </p>
            </div>
            <div className="p-6">
              <Toggle
                label="Allow Helen to create new tags"
                description="When enabled, Helen can create up to 3 new tags per ticket if no existing AI-assignable tags are suitable. New tags are created with a violet colour and marked as AI-assignable."
                checked={settings.helen_create_tags === 'true'}
                onChange={() => toggleBool('helen_create_tags')}
              />
            </div>
          </div>
        </>
      )}

      {/* AutoGRUMP™ */}
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30">
        <div className="border-b border-amber-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">😠</span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AutoGRUMP™ — Tone Monitoring</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Analyses incoming customer messages for frustration and flags tickets needing urgent attention.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <Toggle
            label="Enable AutoGRUMP"
            description="When enabled, AutoGRUMP analyses the tone of incoming customer messages and flags tickets where customers appear frustrated or angry. This helps your team prioritise responses and adjust their communication style."
            checked={settings.autogrump_enabled === 'true'}
            onChange={() => toggleBool('autogrump_enabled')}
          />
          {grumpStats && (
            <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {grumpStats.flagged > 0
                  ? `${grumpStats.flagged} ticket${grumpStats.flagged !== 1 ? 's' : ''} currently flagged`
                  : 'No tickets currently flagged'}
                {' · Analysis runs automatically on each customer reply'}
              </p>
            </div>
          )}
          <div className="pt-2">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Clear All Scores
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-xs text-red-700 dark:text-red-400">This will reset all tone scores on all tickets. Are you sure?</p>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={async () => {
                    setClearing(true)
                    const result = await clearAllToneScores()
                    setClearing(false)
                    setShowClearConfirm(false)
                    setGrumpStats({ flagged: 0 })
                    setMessage({ type: 'success', text: `Cleared tone scores from ${result.cleared} ticket${result.cleared !== 1 ? 's' : ''}.` })
                  }}
                  className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {clearing ? 'Clearing...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
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
