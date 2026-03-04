'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { addScratchpadNote } from '../../actions'

interface PriorAssistLog {
  id: string
  response_body: string | null
  created_at: string
}

interface AssistStep {
  action: string
  explanation: string
  expectedOutcome: string
}

interface AssistResponse {
  summary: string
  possibleCauses: string[]
  steps: AssistStep[]
  followUpQuestions: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface TicketContextForAssist {
  ticketNumber: string
  subject: string
  description: string | null
  customerName: string
  contactName: string | null
  status: string
  priority: string
  ticketType: string
  category: string | null
  categoryId: string | null
  assigneeName: string | null
  messages: {
    senderType: 'agent' | 'customer' | 'system'
    senderName: string | null
    body: string
    isInternal: boolean
    createdAt: string
  }[]
}

const confidenceConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High Confidence', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  medium: { label: 'Medium Confidence', color: 'text-amber-700', bg: 'bg-amber-50' },
  low: { label: 'Low Confidence', color: 'text-red-700', bg: 'bg-red-50' },
}

function SkeletonCard() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-5/6" />
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HelenAssistModal({
  ticketId,
  ticketContext,
  assistHistory = [],
  onClose,
  onComposeReply,
}: {
  ticketId: string
  ticketContext: TicketContextForAssist
  assistHistory?: PriorAssistLog[]
  onClose: () => void
  onComposeReply?: (text: string) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AssistResponse | null>(null)
  const [savedToScratchpad, setSavedToScratchpad] = useState(false)
  const [copiedSteps, setCopiedSteps] = useState(false)
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set())
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [dismissedWarning, setDismissedWarning] = useState(false)

  // Determine if this is a repeat use and if the customer has responded since the last assist
  const hasPriorAssist = assistHistory.length > 0
  const lastAssistAt = hasPriorAssist ? assistHistory[0].created_at : null

  const customerResponseSinceLastAssist = useMemo(() => {
    if (!lastAssistAt) return true // first use, no issue
    const lastAssistTime = new Date(lastAssistAt).getTime()
    return ticketContext.messages.some(
      (m) => m.senderType === 'customer' && new Date(m.createdAt).getTime() > lastAssistTime
    )
  }, [lastAssistAt, ticketContext.messages])

  const showNoResponseWarning = hasPriorAssist && !customerResponseSinceLastAssist && !dismissedWarning

  // Build auto-populated context from prior diagnostics + conversation
  const priorDiagnosticSummaries = useMemo(() => {
    return assistHistory.map((log) => {
      let summary = ''
      const steps: string[] = []
      if (log.response_body) {
        try {
          const cleaned = log.response_body.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
          const parsed = JSON.parse(cleaned)
          summary = parsed.summary || ''
          if (parsed.steps) {
            for (const s of parsed.steps) {
              steps.push(s.action || '')
            }
          }
        } catch {
          summary = log.response_body.slice(0, 100)
        }
      }
      return { createdAt: log.created_at, summary, steps }
    })
  }, [assistHistory])

  // Auto-populate "what have you tried" with prior context
  const autoContext = useMemo(() => {
    if (!hasPriorAssist) return ''

    const lines: string[] = []

    // Summarise prior AI diagnostics
    priorDiagnosticSummaries.forEach((d, i) => {
      const time = new Date(d.createdAt).toLocaleString('en-GB')
      lines.push(`[Previous AI diagnostic ${i + 1} — ${time}]`)
      if (d.summary) lines.push(`Assessment: ${d.summary}`)
      if (d.steps.length > 0) {
        lines.push(`Steps suggested: ${d.steps.join('; ')}`)
      }
      lines.push('')
    })

    // Pull in agent messages since last assist
    if (lastAssistAt) {
      const lastAssistTime = new Date(lastAssistAt).getTime()
      const agentMessagesSince = ticketContext.messages.filter(
        (m) => m.senderType === 'agent' && !m.isInternal && new Date(m.createdAt).getTime() > lastAssistTime
      )
      if (agentMessagesSince.length > 0) {
        lines.push('[Agent responses since last diagnostic]')
        agentMessagesSince.forEach((m) => {
          lines.push(`- ${m.body.slice(0, 200)}${m.body.length > 200 ? '...' : ''}`)
        })
        lines.push('')
      }

      // Pull in customer responses since last assist
      const customerMessagesSince = ticketContext.messages.filter(
        (m) => m.senderType === 'customer' && new Date(m.createdAt).getTime() > lastAssistTime
      )
      if (customerMessagesSince.length > 0) {
        lines.push('[Customer responses since last diagnostic]')
        customerMessagesSince.forEach((m) => {
          lines.push(`- ${m.body.slice(0, 200)}${m.body.length > 200 ? '...' : ''}`)
        })
      }
    }

    return lines.join('\n').trim()
  }, [hasPriorAssist, priorDiagnosticSummaries, lastAssistAt, ticketContext.messages])

  const [additionalContext, setAdditionalContext] = useState(autoContext)

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/helpdesk/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          ticketContext,
          additionalContext: additionalContext.trim() || undefined,
          priorDiagnostics: priorDiagnosticSummaries.length > 0 ? priorDiagnosticSummaries : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const data = await res.json()
      setResult(data.assistResponse)
      // Select all steps and questions by default
      const steps = data.assistResponse?.steps || []
      setSelectedSteps(new Set(steps.map((_: unknown, i: number) => i)))
      const questions = data.assistResponse?.followUpQuestions || []
      setSelectedQuestions(new Set(questions.map((_: unknown, i: number) => i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [ticketId, ticketContext, additionalContext, priorDiagnosticSummaries])

  async function handleSaveToScratchpad() {
    if (!result) return

    const body = formatResultForScratchpad(result)
    await addScratchpadNote(ticketId, {
      title: `AI Diagnostic: ${ticketContext.subject.slice(0, 50)}`,
      body,
      source: 'helen_assist',
    })
    setSavedToScratchpad(true)
    router.refresh()
  }

  function handleCopySteps() {
    if (!result) return
    const text = formatResultForCopy(result)
    navigator.clipboard.writeText(text)
    setCopiedSteps(true)
    setTimeout(() => setCopiedSteps(false), 2000)
  }

  function toggleStep(index: number) {
    setSelectedSteps(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function toggleAllSteps() {
    if (!result) return
    if (selectedSteps.size === result.steps.length) {
      setSelectedSteps(new Set())
    } else {
      setSelectedSteps(new Set(result.steps.map((_, i) => i)))
    }
  }

  function toggleQuestion(index: number) {
    setSelectedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function toggleAllQuestions() {
    if (!result) return
    if (selectedQuestions.size === result.followUpQuestions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(result.followUpQuestions.map((_, i) => i)))
    }
  }

  function handleComposeFromSteps() {
    if (!result || !onComposeReply) return
    const picked = result.steps.filter((_, i) => selectedSteps.has(i))
    if (picked.length === 0) return
    const contactFirst = ticketContext.contactName?.split(' ')[0] || 'there'
    const lines = [`Hi ${contactFirst},\n`]
    lines.push('I\'ve looked into this and have some steps that should help resolve the issue:\n')
    picked.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.action}`)
      if (s.expectedOutcome) lines.push(`   (${s.expectedOutcome})`)
    })
    lines.push('\nPlease try these and let me know how you get on.\n')
    lines.push('Kind regards')
    onComposeReply(lines.join('\n'))
  }

  function handleComposeFromQuestions() {
    if (!result || !onComposeReply) return
    const picked = result.followUpQuestions.filter((_, i) => selectedQuestions.has(i))
    if (picked.length === 0) return
    const contactFirst = ticketContext.contactName?.split(' ')[0] || 'there'
    const lines = [`Hi ${contactFirst},\n`]
    lines.push('To help me investigate this further, could you please let me know:\n')
    picked.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`)
    })
    lines.push('\nThis will help us get to the bottom of the issue more quickly.\n')
    lines.push('Kind regards')
    onComposeReply(lines.join('\n'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100">
              <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Helen AI Diagnostic</h3>
                {hasPriorAssist && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Run #{assistHistory.length + 1}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{ticketContext.ticketNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!result && !loading && (
            <>
              {/* No customer response warning */}
              {showNoResponseWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">
                        The customer hasn&apos;t responded since the last diagnostic
                      </p>
                      <p className="mt-0.5 text-xs text-amber-600">
                        You last ran diagnostics {new Date(lastAssistAt!).toLocaleString('en-GB')}. Running again without new information from the customer may produce similar results.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => setDismissedWarning(true)}
                          className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
                        >
                          Continue Anyway
                        </button>
                        <button
                          onClick={onClose}
                          className="rounded border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Prior diagnostics summary */}
              {hasPriorAssist && !showNoResponseWarning && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Repeat diagnosis &mdash; run #{assistHistory.length + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Helen will review new conversation updates and avoid repeating previous suggestions.
                  </p>
                </div>
              )}

              {!showNoResponseWarning && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {hasPriorAssist ? (
                      <>Context from this ticket <span className="text-slate-400">(auto-populated, edit as needed)</span></>
                    ) : (
                      <>What have you already tried? <span className="text-slate-400">(optional)</span></>
                    )}
                  </label>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={hasPriorAssist ? 6 : 3}
                    placeholder="e.g. Asked customer to restart, checked network connectivity..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 resize-y focus:border-teal-300 focus:ring-1 focus:ring-teal-300 focus:outline-none"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                  <button onClick={handleSubmit} className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline">
                    Retry
                  </button>
                </div>
              )}
            </>
          )}

          {loading && <SkeletonCard />}

          {result && (
            <div className="space-y-4">
              {/* Confidence badge */}
              <div className="flex items-center gap-2">
                {confidenceConfig[result.confidence] && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${confidenceConfig[result.confidence].color} ${confidenceConfig[result.confidence].bg}`}>
                    {confidenceConfig[result.confidence].label}
                  </span>
                )}
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Summary</h4>
                <p className="text-sm font-medium text-slate-800">{result.summary}</p>
              </div>

              {/* Possible Causes */}
              {result.possibleCauses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Possible Causes</h4>
                  <ul className="space-y-1">
                    {result.possibleCauses.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resolution Steps */}
              {result.steps.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resolution Steps</h4>
                      {onComposeReply && (
                        <button
                          onClick={toggleAllSteps}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          {selectedSteps.size === result.steps.length ? 'Deselect all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    {onComposeReply && (
                      <button
                        onClick={handleComposeFromSteps}
                        disabled={selectedSteps.size === 0}
                        className="flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                        Compose Reply{selectedSteps.size < result.steps.length ? ` (${selectedSteps.size})` : ''}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {result.steps.map((step, i) => {
                      const isSelected = selectedSteps.has(i)
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? 'border-gray-100 bg-slate-50/50'
                              : 'border-gray-100 bg-white opacity-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {onComposeReply && (
                              <button
                                onClick={() => toggleStep(i)}
                                className="mt-0.5 shrink-0"
                                title={isSelected ? 'Exclude from reply' : 'Include in reply'}
                              >
                                <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                  isSelected
                                    ? 'border-teal-500 bg-teal-500'
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}>
                                  {isSelected && (
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            )}
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700 shrink-0">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{step.action}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{step.explanation}</p>
                              {step.expectedOutcome && (
                                <p className="mt-1 text-xs text-emerald-600">
                                  <span className="font-medium">Expected:</span> {step.expectedOutcome}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Follow-up Questions */}
              {result.followUpQuestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Follow-up Questions</h4>
                      {onComposeReply && (
                        <button
                          onClick={toggleAllQuestions}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          {selectedQuestions.size === result.followUpQuestions.length ? 'Deselect all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    {onComposeReply && (
                      <button
                        onClick={handleComposeFromQuestions}
                        disabled={selectedQuestions.size === 0}
                        className="flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                        Compose Reply{selectedQuestions.size < result.followUpQuestions.length ? ` (${selectedQuestions.size})` : ''}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {result.followUpQuestions.map((q, i) => {
                      const isSelected = selectedQuestions.has(i)
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? 'border-purple-200 bg-purple-50/50'
                              : 'border-purple-100 bg-white opacity-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {onComposeReply && (
                              <button
                                onClick={() => toggleQuestion(i)}
                                className="mt-0.5 shrink-0"
                                title={isSelected ? 'Exclude from reply' : 'Include in reply'}
                              >
                                <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}>
                                  {isSelected && (
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            )}
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 shrink-0">
                              {i + 1}
                            </span>
                            <p className="text-sm text-slate-700">{q}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          {!result ? (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
              {!showNoResponseWarning && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analysing...
                    </>
                  ) : (
                    hasPriorAssist ? 'Re-diagnose' : 'Diagnose'
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySteps}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copiedSteps ? 'Copied!' : 'Copy Steps'}
                </button>
                <button
                  onClick={handleSaveToScratchpad}
                  disabled={savedToScratchpad}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {savedToScratchpad ? 'Saved to Scratchpad' : 'Save to Scratchpad'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatResultForScratchpad(result: AssistResponse): string {
  const lines: string[] = []

  lines.push(`**Summary:** ${result.summary}`)
  lines.push(`**Confidence:** ${result.confidence}`)
  lines.push('')

  if (result.possibleCauses.length > 0) {
    lines.push('**Possible Causes:**')
    result.possibleCauses.forEach((c) => lines.push(`- ${c}`))
    lines.push('')
  }

  if (result.steps.length > 0) {
    lines.push('**Resolution Steps:**')
    result.steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.action}`)
      lines.push(`   Why: ${s.explanation}`)
      if (s.expectedOutcome) lines.push(`   Expected: ${s.expectedOutcome}`)
    })
    lines.push('')
  }

  if (result.followUpQuestions.length > 0) {
    lines.push('**Follow-up Questions:**')
    result.followUpQuestions.forEach((q) => lines.push(`- ${q}`))
  }

  return lines.join('\n')
}

function formatResultForCopy(result: AssistResponse): string {
  const lines: string[] = []

  lines.push(`Summary: ${result.summary}`)
  lines.push('')

  if (result.steps.length > 0) {
    lines.push('Resolution Steps:')
    result.steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.action}`)
      lines.push(`   ${s.explanation}`)
      if (s.expectedOutcome) lines.push(`   Expected: ${s.expectedOutcome}`)
    })
  }

  return lines.join('\n')
}
