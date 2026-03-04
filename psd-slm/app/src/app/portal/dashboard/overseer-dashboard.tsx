'use client'

import Link from 'next/link'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

function formatDuration(ms: number) {
  if (ms <= 0) return '—'
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

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  high: '#d97706',
  medium: '#2563eb',
  low: '#6b7280',
}

interface DashboardData {
  openCount: number
  urgentHigh: number
  avgResolutionMs: number
  slaCompliancePct: number
  priorityCounts: Record<string, number>
  recentTickets: Record<string, unknown>[]
  weeklyTrend: [string, number][]
}

export function OverseerDashboard({ data, companyName }: { data: DashboardData; companyName: string }) {
  const totalPriority = Object.values(data.priorityCounts).reduce((a, b) => a + b, 0)
  const maxWeekly = Math.max(...data.weeklyTrend.map(([, v]) => v), 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Support overview for {companyName}</p>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Open Tickets</div>
          <div className="text-2xl font-bold text-slate-900">{data.openCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Urgent / High</div>
          <div className="text-2xl font-bold" style={{ color: data.urgentHigh > 0 ? '#dc2626' : '#1e293b' }}>
            {data.urgentHigh}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Avg Resolution</div>
          <div className="text-2xl font-bold text-slate-900">{formatDuration(data.avgResolutionMs)}</div>
          <div className="text-xs text-slate-400">Last 30 days</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">SLA Compliance</div>
          <div
            className="text-2xl font-bold"
            style={{ color: data.slaCompliancePct >= 90 ? '#059669' : data.slaCompliancePct >= 75 ? '#d97706' : '#dc2626' }}
          >
            {data.slaCompliancePct}%
          </div>
          <div className="text-xs text-slate-400">Last 30 days</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Open Tickets by Priority</h3>
          {totalPriority === 0 ? (
            <p className="text-sm text-slate-400">No open tickets</p>
          ) : (
            <div className="space-y-3">
              {['urgent', 'high', 'medium', 'low'].map(p => {
                const count = data.priorityCounts[p] || 0
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

        {/* Weekly Trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Weekly Ticket Trend</h3>
          {data.weeklyTrend.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {data.weeklyTrend.map(([week, count]) => {
                const pct = maxWeekly > 0 ? (count / maxWeekly) * 100 : 0
                return (
                  <div key={week} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full rounded-t bg-indigo-500 transition-all hover:bg-indigo-600 min-h-[2px]"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap z-10">
                      w/c {new Date(week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}: {count}
                    </div>
                    <span className="mt-1 text-[9px] text-slate-400">
                      {new Date(week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Tickets */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Recent Tickets</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left font-medium text-slate-500">Ticket #</th>
                <th className="pb-2 text-left font-medium text-slate-500">Subject</th>
                <th className="pb-2 text-left font-medium text-slate-500">Raised By</th>
                <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                <th className="pb-2 text-left font-medium text-slate-500">Priority</th>
                <th className="pb-2 text-left font-medium text-slate-500">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTickets.map((ticket, i) => {
                const t = ticket as Record<string, unknown>
                const statusCfg = TICKET_STATUS_CONFIG[t.status as string]
                const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority as string]
                const contact = t.contacts as Record<string, unknown> | null
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2">
                      <Link href={`/portal/tickets/${t.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 no-underline">
                        {t.ticket_number as string}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-900">{t.subject as string}</td>
                    <td className="py-2 text-slate-600">
                      {contact ? `${contact.first_name} ${contact.last_name}` : '—'}
                    </td>
                    <td className="py-2">
                      {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
                    </td>
                    <td className="py-2">
                      {priorityCfg ? <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} /> : null}
                    </td>
                    <td className="py-2 text-slate-500">
                      {new Date(t.updated_at as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
              {data.recentTickets.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-slate-400">No tickets yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
