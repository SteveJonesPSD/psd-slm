'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  type AiScenario,
  type AgentId,
  type ScenarioGuardrails,
  type DryRunResult,
  DEFAULT_GUARDRAILS,
  AGENT_CONFIG,
} from '@/lib/ai-scenarios/types'
import { saveScenario, testScenarioMatch, sendTestEmail } from '@/lib/ai-scenarios/actions'

interface Props {
  scenario: AiScenario | null
  onClose: () => void
}

export function ScenarioForm({ scenario, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isTesting, setIsTesting] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [testResult, setTestResult] = useState<DryRunResult | null>(null)
  const [sendResult, setSendResult] = useState<{ success: boolean; sentTo?: string; sentFrom?: string; error?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(scenario?.name || '')
  const [description, setDescription] = useState(scenario?.description || '')
  const [agentId, setAgentId] = useState<AgentId>(scenario?.agent_id || 'helen')
  const [priority, setPriority] = useState(scenario?.priority ?? 10)
  const [triggerPrompt, setTriggerPrompt] = useState(scenario?.trigger_prompt || '')
  const [actionPrompt, setActionPrompt] = useState(scenario?.action_prompt || '')
  const [guardrails, setGuardrails] = useState<ScenarioGuardrails>(
    scenario?.guardrails || { ...DEFAULT_GUARDRAILS }
  )

  // Test email state
  const [testSenderEmail, setTestSenderEmail] = useState('')
  const [testSenderName, setTestSenderName] = useState('')
  const [testSubject, setTestSubject] = useState('')
  const [testBody, setTestBody] = useState('')

  const handleSave = async () => {
    setError(null)
    startTransition(async () => {
      try {
        await saveScenario({
          id: scenario?.id,
          name,
          description: description || null,
          agent_id: agentId,
          trigger_prompt: triggerPrompt,
          action_prompt: actionPrompt,
          guardrails,
          priority,
          is_active: scenario?.is_active ?? true,
        })
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save scenario')
      }
    })
  }

  const handleTest = async () => {
    if (!triggerPrompt.trim() || !actionPrompt.trim()) {
      setError('Trigger and action prompts are required to run a test')
      return
    }
    if (!testSubject.trim() && !testBody.trim()) {
      setError('Enter a sample subject or body to test against')
      return
    }

    setError(null)
    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await testScenarioMatch({
        trigger_prompt: triggerPrompt,
        action_prompt: actionPrompt,
        agent_id: agentId,
        guardrails,
        sample_email: {
          subject: testSubject,
          body: testBody,
          sender_email: testSenderEmail || 'test@example.com',
          sender_name: testSenderName || 'Test User',
        },
      })
      setTestResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testResult?.would_match) return

    setSendResult(null)
    setIsSendingTest(true)
    try {
      const subject = testSubject ? `Re: ${testSubject}` : 'AI Scenario Test Response'
      const result = await sendTestEmail({
        subject,
        action_prompt: actionPrompt,
        agent_id: agentId,
        sample_email: {
          subject: testSubject,
          body: testBody,
          sender_email: testSenderEmail || 'test@example.com',
          sender_name: testSenderName || 'Test User',
        },
      })
      setSendResult(result)
    } catch (err) {
      setSendResult({ success: false, error: err instanceof Error ? err.message : 'Failed to send' })
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {scenario ? 'Edit Scenario' : 'Create Scenario'}
          </h2>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Identity */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Identity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Invoice Request Handler"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of what this scenario handles"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Agent
                  </label>
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value as AgentId)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {(Object.entries(AGENT_CONFIG) as [AgentId, typeof AGENT_CONFIG['helen']][]).map(([id, config]) => (
                      <option key={id} value={id}>
                        {config.label} — {config.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">Lower number runs first</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Trigger */}
          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">When to respond</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Describe in plain English what types of emails this scenario should match. Be specific about the intent, not just keywords.
            </p>
            <textarea
              value={triggerPrompt}
              onChange={(e) => setTriggerPrompt(e.target.value)}
              rows={4}
              placeholder="Match emails from customers asking about invoices — for example requesting a copy of an invoice, querying a charge, or asking when an invoice is due for payment."
              className="w-full rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Section 3: Action */}
          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">What to do</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Describe what the AI agent should do when this scenario matches. Reference specific data lookups, PDFs, or reply formatting as needed.
            </p>
            <textarea
              value={actionPrompt}
              onChange={(e) => setActionPrompt(e.target.value)}
              rows={4}
              placeholder="Find the customer's last 3 invoices. Render each as a PDF. Construct a friendly email reply from the agent, attaching the PDFs and summarising the invoice numbers, dates, and totals."
              className="w-full rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Section 4: Guardrails */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Guardrails</h3>
            <div className="space-y-4">
              {/* Known contacts only — locked */}
              <div className="flex items-center gap-3">
                <input type="checkbox" checked disabled className="h-4 w-4 rounded opacity-50" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Known contacts only</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Always enforced — unknown senders are rejected before scenario evaluation</p>
                </div>
              </div>

              {/* Max per sender per day */}
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300">Max responses per sender per day</p>
                </div>
                <input
                  type="number"
                  value={guardrails.max_per_sender_per_day}
                  onChange={(e) => setGuardrails({ ...guardrails, max_per_sender_per_day: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                  min={1}
                  max={50}
                  className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-center text-slate-900 dark:text-white"
                />
              </div>

              {/* Business hours only */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">Business hours only</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Only respond Mon–Fri 08:00–18:00 UK time</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuardrails({ ...guardrails, business_hours_only: !guardrails.business_hours_only })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    guardrails.business_hours_only ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    guardrails.business_hours_only ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Escalate on failure */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">Escalate to helpdesk on failure</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">If the agent fails, create a helpdesk ticket so a human can follow up</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuardrails({ ...guardrails, escalate_to_helpdesk_on_failure: !guardrails.escalate_to_helpdesk_on_failure })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    guardrails.escalate_to_helpdesk_on_failure ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    guardrails.escalate_to_helpdesk_on_failure ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Dry Run */}
              <div className="flex items-center justify-between rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    DRY RUN
                  </span>
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">Dry Run mode</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Match and log emails without sending any replies. Use this to test a new scenario safely before going live.</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuardrails({ ...guardrails, dry_run: !guardrails.dry_run })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    guardrails.dry_run ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    guardrails.dry_run ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Test */}
          <div>
            <button
              onClick={() => setShowTest(!showTest)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
            >
              <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              Test This Scenario (Dry Run)
              <svg className={`h-4 w-4 text-slate-400 transition-transform ${showTest ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Paste a sample email to see whether this scenario would match and preview what the agent would do — no email will be sent.
            </p>

            {showTest && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sender email</label>
                    <input
                      type="email"
                      value={testSenderEmail}
                      onChange={(e) => setTestSenderEmail(e.target.value)}
                      placeholder="jane@customer.com"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sender name</label>
                    <input
                      type="text"
                      value={testSenderName}
                      onChange={(e) => setTestSenderName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    placeholder="RE: Invoice query"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Body</label>
                  <textarea
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    rows={4}
                    placeholder="Hi, could you please send me a copy of our latest invoice? Thanks, Jane"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>
                <Button variant="purple" size="sm" onClick={handleTest} disabled={isTesting}>
                  {isTesting ? 'Running...' : 'Run Test'}
                </Button>

                {testResult && (
                  <div className="mt-4 space-y-3">
                    {/* Match result banner */}
                    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                      testResult.would_match
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                      {testResult.would_match ? 'Would Match' : 'Would Not Match'}
                    </div>

                    {/* Rationale */}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Rationale:</span> {testResult.match_rationale}
                    </p>

                    {/* Simulated response */}
                    {testResult.simulated_response_preview && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Simulated Response</p>
                          <Button variant="blue" size="sm" onClick={handleSendTestEmail} disabled={isSendingTest}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            {isSendingTest ? 'Sending...' : 'Send to me'}
                          </Button>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {testResult.simulated_response_preview}
                        </p>
                        {sendResult && (
                          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                            sendResult.success
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          }`}>
                            {sendResult.success
                              ? `Sent to ${sendResult.sentTo} from ${sendResult.sentFrom}`
                              : sendResult.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Guardrail notes */}
                    {testResult.guardrail_notes.length > 0 && (
                      <div className="space-y-1">
                        {testResult.guardrail_notes.map((note, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ {note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="default" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="purple" size="sm" onClick={handleSave} disabled={isPending || !name.trim() || !triggerPrompt.trim() || !actionPrompt.trim()}>
            {isPending ? 'Saving...' : scenario ? 'Update Scenario' : 'Create Scenario'}
          </Button>
        </div>
      </div>
    </div>
  )
}
