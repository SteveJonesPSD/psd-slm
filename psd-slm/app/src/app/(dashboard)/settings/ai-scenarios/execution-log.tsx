'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  type AiScenario,
  type AiScenarioExecution,
  type ScenarioStatus,
  AGENT_CONFIG,
  STATUS_CONFIG,
} from '@/lib/ai-scenarios/types'
import { clearExecutionLog } from '@/lib/ai-scenarios/actions'

interface Props {
  executions: AiScenarioExecution[]
  scenarios: AiScenario[]
}

export function ExecutionLog({ executions, scenarios }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ScenarioStatus | ''>('')
  const [scenarioFilter, setScenarioFilter] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = executions.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false
    if (scenarioFilter && e.scenario_id !== scenarioFilter) return false
    return true
  })

  const handleClear = async () => {
    startTransition(async () => {
      await clearExecutionLog()
      setConfirmClear(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Response Log</h3>
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
            {executions.length}
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ScenarioStatus | '')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="matched">Matched</option>
              <option value="dry_run">Dry Run</option>
              <option value="no_match">No Match</option>
              <option value="guardrail_blocked">Blocked</option>
              <option value="escalated">Escalated</option>
              <option value="error">Error</option>
            </select>

            <select
              value={scenarioFilter}
              onChange={(e) => setScenarioFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
            >
              <option value="">All Scenarios</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <div className="ml-auto">
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Clear all entries?</span>
                  <Button variant="danger" size="sm" onClick={handleClear} disabled={isPending}>
                    Confirm
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={() => setConfirmClear(true)} disabled={executions.length === 0}>
                  Clear Log
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No log entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Time</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Scenario</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Agent</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Sender</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Subject</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exec) => {
                    const agent = AGENT_CONFIG[exec.agent_id as keyof typeof AGENT_CONFIG]
                    const statusCfg = STATUS_CONFIG[exec.status]
                    const isOpen = expandedRow === exec.id

                    return (
                      <Fragment key={exec.id}>
                        <tr
                          className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                          onClick={() => setExpandedRow(isOpen ? null : exec.id)}
                        >
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTime(exec.executed_at)}
                          </td>
                          <td className={`px-4 py-3 text-sm ${exec.status === 'no_match' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {exec.scenario_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {agent && (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ color: agent.color, backgroundColor: agent.bg }}
                              >
                                {agent.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-slate-900 dark:text-white whitespace-nowrap">{exec.sender_name || exec.sender_email}</div>
                            {exec.sender_name && (
                              <div className="text-xs text-slate-400 whitespace-nowrap">{exec.sender_email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {exec.customer_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                            {exec.email_subject}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <svg
                              className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="px-4 py-4 bg-slate-50 dark:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700">
                              <ExecutionDetail exec={exec} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExecutionDetail({ exec }: { exec: AiScenarioExecution }) {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Email Preview */}
      {exec.email_preview && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email Preview</p>
          <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {exec.email_preview}
          </div>
        </div>
      )}

      {/* Match Rationale */}
      {exec.match_rationale && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Match Rationale</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{exec.match_rationale}</p>
        </div>
      )}

      {/* Actions Taken */}
      {exec.actions_taken && exec.actions_taken.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Actions Taken</p>
          <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
            {exec.actions_taken.map((action, i) => (
              <li key={i}>{typeof action === 'object' && action !== null ? (action as Record<string, unknown>).action as string || JSON.stringify(action) : String(action)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Response Preview */}
      {exec.response_preview && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Response Preview</p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {exec.response_preview}
          </div>
        </div>
      )}

      {/* Channel / Mailbox */}
      {(exec.channel_name || exec.mailbox_address) && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Channel</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {exec.channel_name}{exec.mailbox_address ? ` (${exec.mailbox_address})` : ''}
          </p>
        </div>
      )}

      {/* Error Detail */}
      {exec.error_detail && (
        <div>
          <p className="text-xs font-medium text-red-500 mb-1">Error Detail</p>
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {exec.error_detail}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// React Fragment import
import { Fragment } from 'react'
