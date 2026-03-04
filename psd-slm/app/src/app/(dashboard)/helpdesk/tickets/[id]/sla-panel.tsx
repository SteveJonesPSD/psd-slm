'use client'

import { getSlaStatus, formatTimeRemaining } from '@/lib/sla'

export function SlaPanel({ ticket }: { ticket: Record<string, unknown> }) {
  const hasResponse = !!ticket.sla_response_due_at
  const hasResolution = !!ticket.sla_resolution_due_at
  const planName = ticket.sla_plans
    ? (ticket.sla_plans as Record<string, unknown>).name as string
    : null

  if (!hasResponse && !hasResolution) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">SLA</h4>
        <p className="mt-2 text-xs text-slate-400">No SLA plan assigned</p>
      </div>
    )
  }

  const responseStatus = getSlaStatus(
    ticket.sla_response_due_at as string | null,
    ticket.first_responded_at as string | null,
    ticket.created_at as string
  )
  const resolutionStatus = getSlaStatus(
    ticket.sla_resolution_due_at as string | null,
    ticket.resolved_at as string | null,
    ticket.created_at as string
  )

  function statusColor(status: string) {
    switch (status) {
      case 'breached': return '#dc2626'
      case 'at_risk': return '#d97706'
      case 'met': return '#059669'
      default: return '#059669'
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'breached': return 'Breached'
      case 'at_risk': return 'At Risk'
      case 'met': return 'Met'
      default: return 'On Track'
    }
  }

  function progressPct(dueAt: string | null, createdAt: string | null, completedAt: string | null) {
    if (!dueAt || !createdAt) return 0
    if (completedAt) return 100 // Completed
    const total = new Date(dueAt).getTime() - new Date(createdAt).getTime()
    const elapsed = Date.now() - new Date(createdAt).getTime()
    if (total <= 0) return 100
    return Math.min(Math.max((elapsed / total) * 100, 0), 100)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">SLA</h4>
        {planName && <span className="text-[10px] text-slate-400">{planName}</span>}
      </div>

      {/* Response SLA */}
      {hasResponse && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">Response</span>
            <span className="text-xs font-semibold" style={{ color: statusColor(responseStatus) }}>
              {ticket.first_responded_at
                ? statusLabel(responseStatus)
                : formatTimeRemaining(ticket.sla_response_due_at as string)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${progressPct(ticket.sla_response_due_at as string, ticket.created_at as string, ticket.first_responded_at as string | null)}%`,
                backgroundColor: statusColor(responseStatus),
              }}
            />
          </div>
          {ticket.first_responded_at ? (
            <div className="mt-1 text-[10px] text-slate-400">
              Responded {new Date(ticket.first_responded_at as string).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : null}
        </div>
      )}

      {/* Resolution SLA */}
      {hasResolution && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">Resolution</span>
            <span className="text-xs font-semibold" style={{ color: statusColor(resolutionStatus) }}>
              {ticket.resolved_at
                ? statusLabel(resolutionStatus)
                : formatTimeRemaining(ticket.sla_resolution_due_at as string)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${progressPct(ticket.sla_resolution_due_at as string, ticket.created_at as string, ticket.resolved_at as string | null)}%`,
                backgroundColor: statusColor(resolutionStatus),
              }}
            />
          </div>
          {ticket.resolved_at ? (
            <div className="mt-1 text-[10px] text-slate-400">
              Resolved {new Date(ticket.resolved_at as string).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : null}
        </div>
      )}

      {/* Paused indicator */}
      {ticket.sla_paused_at ? (
        <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 font-medium">
          SLA Clock Paused (waiting on customer)
        </div>
      ) : null}
    </div>
  )
}
