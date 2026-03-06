import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalTickets, getPortalTicketStats } from '@/lib/portal/helpdesk-actions'
import { formatRelativeTime } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  waiting_on_customer: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Awaiting Your Reply',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-500',
}

export default async function PortalHelpdeskPage() {
  const ctx = await requirePortalSession()
  const [tickets, stats] = await Promise.all([
    getPortalTickets(ctx, 'all'),
    getPortalTicketStats(ctx),
  ])

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage your support tickets</p>
        </div>
        <Link
          href="/portal/helpdesk/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Raise a Ticket
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Open</div>
          <div className="mt-1 text-xl font-bold text-red-600">{stats.open}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Awaiting Reply</div>
          <div className="mt-1 text-xl font-bold text-purple-600">{stats.pendingResponse}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Resolved This Month</div>
          <div className="mt-1 text-xl font-bold text-green-600">{stats.resolvedThisMonth}</div>
        </div>
      </div>

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No support tickets yet
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/portal/helpdesk/${t.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{t.ticketNumber}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[t.priority] || 'bg-slate-100 text-slate-500'}`}>
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 truncate">{t.subject}</p>
                  <div className="mt-1 text-xs text-slate-400">
                    {t.assignedToName && <span>Assigned to {t.assignedToName}</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(t.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
