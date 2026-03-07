'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import {
  type AiScenario,
  type AiScenarioExecution,
  type ScenarioStatus,
  AGENT_CONFIG,
} from '@/lib/ai-scenarios/types'
import { toggleScenarioActive, deleteScenario, updateScenarioPriority } from '@/lib/ai-scenarios/actions'
import { ScenarioForm } from './scenario-form'
import { ExecutionLog } from './execution-log'

interface Props {
  scenarios: AiScenario[]
  stats: {
    total: number
    matched: number
    dry_run: number
    no_match: number
    guardrail_blocked: number
    escalated: number
    error: number
    last_24h: number
  }
  executions: AiScenarioExecution[]
}

export function AiScenariosSettings({ scenarios, stats, executions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingScenario, setEditingScenario] = useState<AiScenario | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const hasDryRunActive = scenarios.some(s => s.is_active && s.guardrails?.dry_run)

  const handleToggleActive = async (id: string, active: boolean) => {
    startTransition(async () => {
      await toggleScenarioActive(id, active)
      router.refresh()
    })
  }

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      await deleteScenario(id)
      setConfirmDelete(null)
      router.refresh()
    })
  }

  const handleEdit = (scenario: AiScenario) => {
    setEditingScenario(scenario)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingScenario(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingScenario(null)
    startTransition(() => {
      router.refresh()
    })
  }

  // Find last matched time per scenario
  const lastMatchedMap = new Map<string, string>()
  for (const exec of executions) {
    if (exec.scenario_id && exec.status === 'matched' && !lastMatchedMap.has(exec.scenario_id)) {
      lastMatchedMap.set(exec.scenario_id, exec.executed_at)
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Response Emails"
        subtitle="Configure AI agents to automatically respond to inbound emails across connected mailboxes"
        actions={
          <Button variant="purple" size="sm" onClick={handleCreate}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Add Scenario
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Scenarios" value={scenarios.length} />
        <StatCard label="Matched (24h)" value={stats.last_24h} color="green" />
        <StatCard label="Blocked / Dry Run" value={stats.guardrail_blocked + stats.dry_run} color="amber" />
        <StatCard label="Errors" value={stats.error} color="red" />
      </div>

      {/* Dry Run Banner */}
      {hasDryRunActive && (
        <div className="mb-8 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              One or more scenarios are in <span className="font-semibold">Dry Run</span> mode — emails will be matched and logged but not sent.
            </p>
          </div>
        </div>
      )}

      {/* Scenarios */}
      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-purple-400 dark:text-purple-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No scenarios configured</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Set up AI scenarios to automatically respond to inbound emails
          </p>
          <Button variant="purple" size="sm" onClick={handleCreate}>
            Add your first scenario
          </Button>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {scenarios.map((scenario) => {
            const agent = AGENT_CONFIG[scenario.agent_id]
            const lastMatched = lastMatchedMap.get(scenario.id)

            return (
              <div
                key={scenario.id}
                className={`rounded-lg border bg-white dark:bg-slate-800 p-5 transition-colors ${
                  scenario.is_active
                    ? 'border-slate-200 dark:border-slate-700'
                    : 'border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Drag handle placeholder */}
                  <div className="mt-1 text-slate-400 dark:text-slate-500 cursor-grab select-none">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {scenario.name}
                      </h3>
                      {/* Agent badge */}
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                        style={{ color: agent.color, backgroundColor: agent.bg }}
                      >
                        <span className="dark:hidden">{agent.label}</span>
                        <span className="hidden dark:inline" style={{ backgroundColor: agent.darkBg, color: agent.color }}>{agent.label}</span>
                      </span>
                      {/* Priority badge */}
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Priority {scenario.priority}
                      </span>
                      {/* Guardrail indicators */}
                      {scenario.guardrails?.dry_run && (
                        <span className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          DRY RUN
                        </span>
                      )}
                      {scenario.guardrails?.business_hours_only && (
                        <span title="Business hours only">
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      )}
                      {(scenario.guardrails?.max_per_sender_per_day ?? 0) > 0 && (
                        <span title={`Max ${scenario.guardrails.max_per_sender_per_day}/sender/day`}>
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {scenario.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-1">
                        {scenario.description}
                      </p>
                    )}

                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {lastMatched
                        ? `Last matched: ${formatTimeAgo(lastMatched)}`
                        : 'Never matched'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(scenario.id, !scenario.is_active)}
                      disabled={isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        scenario.is_active ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          scenario.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleEdit(scenario)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>

                    {/* Delete */}
                    {confirmDelete === scenario.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(scenario.id)} disabled={isPending}>
                          Confirm
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setConfirmDelete(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(scenario.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Execution Log */}
      <ExecutionLog executions={executions} scenarios={scenarios} />

      {/* Scenario Form Modal */}
      {showForm && (
        <ScenarioForm
          scenario={editingScenario}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClasses = {
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ? colorClasses[color as keyof typeof colorClasses] : 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
