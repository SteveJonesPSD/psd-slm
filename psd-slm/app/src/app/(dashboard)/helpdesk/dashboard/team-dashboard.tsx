'use client'

import Link from 'next/link'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, TICKET_PRIORITY_CONFIG, TICKET_STATUS_CONFIG } from '@/components/ui/badge'

function formatDuration(ms: number) {
  if (ms <= 0) return '0m'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    return `${days}d ${remainHours}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

interface DashboardStats {
  openCount: number
  newCount: number
  inProgressCount: number
  escalatedCount: number
  unassigned: number
  slaOverdue: number
  avgResponseMs: number
  avgResolutionMs: number
  slaCompliancePct: number
}

interface DashboardPanels {
  priorityCounts: Record<string, number>
  workload: Record<string, unknown>[]
  dailyVolume: Record<string, number>
  overdueTickets: Record<string, unknown>[]
  categoryCounts: { name: string; count: number }[]
  activity: Record<string, unknown>[]
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  high: '#d97706',
  medium: '#2563eb',
  low: '#6b7280',
}

export function TeamDashboard({ stats, panels }: { stats: DashboardStats; panels: DashboardPanels }) {
  const totalPriority = Object.values(panels.priorityCounts).reduce((a, b) => a + b, 0)
  const maxCategory = Math.max(...panels.categoryCounts.map(c => c.count), 1)
  const maxWorkload = Math.max(...(panels.workload || []).map(w => (w.open_tickets as number) || 0), 1)

  // Daily volume chart data (last 30 days)
  const volumeDays = Object.entries(panels.dailyVolume).sort(([a], [b]) => a.localeCompare(b))
  const maxVolume = Math.max(...volumeDays.map(([, v]) => v), 1)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Team Dashboard</h2>
        <p className="text-sm text-slate-500">Support team metrics and monitoring</p>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 flex flex-wrap gap-4">
        <StatCard
          label="Open Tickets"
          value={stats.openCount}
          sub={`${stats.newCount} new · ${stats.inProgressCount} in progress · ${stats.escalatedCount} escalated`}
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          accent={stats.unassigned > 0 ? '#dc2626' : '#1e293b'}
        />
        <StatCard
          label="SLA Overdue"
          value={stats.slaOverdue}
          accent={stats.slaOverdue > 0 ? '#dc2626' : '#1e293b'}
        />
        <StatCard
          label="Avg Response"
          value={formatDuration(stats.avgResponseMs)}
          sub="Last 30 days"
        />
        <StatCard
          label="Avg Resolution"
          value={formatDuration(stats.avgResolutionMs)}
          sub="Last 30 days"
        />
        <StatCard
          label="SLA Compliance"
          value={`${stats.slaCompliancePct}%`}
          sub="Last 30 days"
          accent={stats.slaCompliancePct >= 90 ? '#059669' : stats.slaCompliancePct >= 75 ? '#d97706' : '#dc2626'}
        />
      </div>

      {/* Panels Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Panel 1: Tickets by Priority */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Tickets by Priority</h3>
          {totalPriority === 0 ? (
            <p className="text-sm text-slate-400">No open tickets</p>
          ) : (
            <div className="space-y-3">
              {['urgent', 'high', 'medium', 'low'].map(p => {
                const count = panels.priorityCounts[p] || 0
                const pct = totalPriority > 0 ? (count / totalPriority) * 100 : 0
                return (
                  <div key={p} className="flex items-center gap-3">
                    <span className="w-16 text-xs font-medium text-slate-600 capitalize">{p}</span>
                    <div className="flex-1 h-5 rounded-full bg-gray-100">
                      <div
                        className="h-5 rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: PRIORITY_COLORS[p] }}
                      >
                        {count > 0 && <span className="text-[10px] font-bold text-white">{count}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 2: Agent Workload */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Agent Workload</h3>
          {panels.workload.length === 0 ? (
            <p className="text-sm text-slate-400">No agent data</p>
          ) : (
            <div className="space-y-3">
              {panels.workload.map((agent, i) => {
                const openTickets = (agent.open_tickets as number) || 0
                const pct = maxWorkload > 0 ? (openTickets / maxWorkload) * 100 : 0
                const hasOverdue = (agent.overdue_tickets as number) > 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: (agent.color as string) || '#6b7280' }}
                      >
                        {(agent.initials as string) || '?'}
                      </div>
                      <span className="text-xs text-slate-600 truncate">
                        {agent.first_name as string} {agent.last_name as string}
                      </span>
                    </div>
                    <div className="flex-1 h-5 rounded-full bg-gray-100">
                      <div
                        className="h-5 rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: hasOverdue ? '#dc2626' : '#2563eb' }}
                      >
                        <span className="text-[10px] font-bold text-white">{openTickets}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 3: Ticket Volume Trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Ticket Volume (30 days)</h3>
          {volumeDays.length === 0 ? (
            <p className="text-sm text-slate-400">No ticket data</p>
          ) : (
            <div className="flex items-end gap-0.5 h-32">
              {volumeDays.map(([day, count]) => {
                const pct = maxVolume > 0 ? (count / maxVolume) * 100 : 0
                return (
                  <div key={day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full rounded-t bg-indigo-500 transition-all hover:bg-indigo-600 min-h-[2px]"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap z-10">
                      {new Date(day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}: {count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 4: Overdue Tickets */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Overdue Tickets</h3>
          {panels.overdueTickets.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
              <span className="text-green-600 text-sm font-medium">All SLAs on track</span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {panels.overdueTickets.map((ticket, i) => {
                const t = ticket as Record<string, unknown>
                const now = Date.now()
                const responseOverdue = t.sla_response_due_at && !t.first_responded_at
                  ? now - new Date(t.sla_response_due_at as string).getTime()
                  : 0
                const resolutionOverdue = t.sla_resolution_due_at && !t.resolved_at
                  ? now - new Date(t.sla_resolution_due_at as string).getTime()
                  : 0
                const maxOverdue = Math.max(responseOverdue, resolutionOverdue)
                const overdueType = responseOverdue > resolutionOverdue ? 'response' : 'resolution'

                return (
                  <Link
                    key={i}
                    href={`/helpdesk/tickets/${t.id}`}
                    className="block rounded-lg border border-red-100 bg-red-50/50 p-2.5 no-underline hover:bg-red-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{t.ticket_number as string}</span>
                      <span className="text-[10px] text-red-600 font-medium">
                        {formatDuration(maxOverdue)} past {overdueType}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">{t.subject as string}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{(t.customers as Record<string, unknown>)?.name as string}</span>
                      {t.users ? (
                        <span>→ {(t.users as Record<string, unknown>).first_name as string} {(t.users as Record<string, unknown>).last_name as string}</span>
                      ) : (
                        <span className="text-red-500">Unassigned</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 5: Tickets by Category */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Tickets by Category</h3>
          {panels.categoryCounts.length === 0 ? (
            <p className="text-sm text-slate-400">No categorised tickets</p>
          ) : (
            <div className="space-y-3">
              {panels.categoryCounts.map((cat, i) => {
                const pct = maxCategory > 0 ? (cat.count / maxCategory) * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-slate-600 truncate">{cat.name}</span>
                    <div className="flex-1 h-5 rounded-full bg-gray-100">
                      <div
                        className="h-5 rounded-full bg-slate-500 transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{cat.count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 6: Recent Activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Recent Activity</h3>
          {panels.activity.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {panels.activity.map((item, i) => {
                const a = item as Record<string, unknown>
                const user = a.user as Record<string, unknown> | null
                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    {user ? (
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white mt-0.5"
                        style={{ backgroundColor: (user.color as string) || '#6b7280' }}
                      >
                        {(user.initials as string) || '?'}
                      </div>
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded-full bg-gray-300 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-600">
                        <span className="font-medium">{user ? `${user.first_name} ${user.last_name}` : 'System'}</span>
                        {' '}{a.action as string}{' '}
                        <span className="text-slate-400">{a.entity_type as string}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(a.created_at as string).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
