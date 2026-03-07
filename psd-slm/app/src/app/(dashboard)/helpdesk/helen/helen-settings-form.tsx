'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
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

const DEFAULT_NUDGE_GUARDRAILS = `- Keep the message to 2-4 sentences maximum
- Never imply the customer is at fault for not responding
- Never threaten ticket closure — only gently offer to close if resolved
- Do not repeat the full technical detail from previous messages
- Do not ask multiple questions — one clear call-to-action only
- If the last agent message asked a specific question, reference it briefly
- Always maintain a helpful, patient tone — even if this is a second nudge`

const DEFAULT_NUDGE_TEMPLATE = `Hi {contact_name},

I just wanted to follow up on your support ticket {ticket_number} regarding "{subject}". We haven't heard back from you and wanted to check if you still need assistance, or if the issue has been resolved.

If everything is sorted, please let us know and we'll close this off. Otherwise, we're here to help.

Regards,
PSD Support`

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
    helen_nudge_enabled: initialSettings.helen_nudge_enabled || 'false',
    helen_nudge_guardrails: initialSettings.helen_nudge_guardrails || DEFAULT_NUDGE_GUARDRAILS,
    helen_nudge_template: initialSettings.helen_nudge_template || DEFAULT_NUDGE_TEMPLATE,
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

          {/* Auto-Nudge */}
          <div className="rounded-xl border-2 border-fuchsia-200 bg-fuchsia-50/30">
            <div className="border-b border-fuchsia-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-fuchsia-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-900">Auto-Nudge</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Automatically send a follow-up message to customers who haven&apos;t responded, prompting them to reply or confirm the issue is resolved.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Toggle
                label="Enable auto-nudge"
                description="Helen will automatically generate and send a nudge message when a ticket reaches 50% of the auto-close period without a customer response. This uses calendar time (including weekends), not business hours. Requires auto-close to be enabled."
                checked={settings.helen_nudge_enabled === 'true'}
                onChange={() => toggleBool('helen_nudge_enabled')}
              />
              <Textarea
                label="Nudge Guardrails"
                value={settings.helen_nudge_guardrails}
                onChange={(v) => update('helen_nudge_guardrails', v)}
                rows={7}
                placeholder="Rules for AI nudge generation, one per line..."
              />
              <p className="text-xs text-slate-400 -mt-2">These rules are injected into the AI prompt when generating nudge messages (both manual and auto). Use them to fine-tune tone, length, and content boundaries.</p>
              {settings.helen_nudge_enabled === 'true' && (
                <>
                  <Textarea
                    label="Nudge Template (fallback)"
                    value={settings.helen_nudge_template}
                    onChange={(v) => update('helen_nudge_template', v)}
                    rows={8}
                    placeholder="Enter fallback nudge template..."
                  />
                  <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">How it works</p>
                    <ul className="space-y-1 text-xs text-slate-500">
                      <li>When a ticket has been waiting for 50% of the auto-close period (calendar time), Helen generates an AI nudge message.</li>
                      <li>The nudge is sent as a customer-facing reply, re-setting the waiting timer.</li>
                      <li>Only one auto-nudge is sent per waiting period. If the customer still doesn&apos;t respond, the ticket proceeds to auto-close as normal.</li>
                      <li>Tickets with &ldquo;Hold Open&rdquo; enabled are excluded.</li>
                      <li>The template above is used as a fallback if AI generation fails.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">Available Placeholders (for fallback template)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-500">
                      <span><code className="rounded bg-slate-200 px-1">{'{ticket_number}'}</code> — Ticket reference</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{customer_name}'}</code> — Company name</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{contact_name}'}</code> — Contact first name</span>
                      <span><code className="rounded bg-slate-200 px-1">{'{subject}'}</code> — Ticket subject</span>
                    </div>
                  </div>
                </>
              )}
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
                <Button
                  variant="danger"
                  size="sm"
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
                  className="shrink-0"
                >
                  {clearing ? 'Clearing...' : 'Confirm'}
                </Button>
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
