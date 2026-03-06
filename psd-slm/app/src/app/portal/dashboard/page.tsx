import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalDashboard, getPortalDashboardSchedule } from '@/lib/portal/dashboard-actions'
import type { PortalDashboardVisit, PortalContractSummary } from '@/lib/portal/dashboard-actions'
import { formatRelativeTime } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildWeekGrids(visits: PortalDashboardVisit[]): { weekLabel: string; weekStart: Date; days: { date: string; dayName: string; dayNum: number; monthShort: string; isToday: boolean; visits: PortalDashboardVisit[] }[] }[] {
  if (visits.length === 0) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = formatDateKey(today)
  const monday = getMonday(today)

  // Group visits by date
  const byDate = new Map<string, PortalDashboardVisit[]>()
  for (const v of visits) {
    const arr = byDate.get(v.visitDate) || []
    arr.push(v)
    byDate.set(v.visitDate, arr)
  }

  // Build up to 4 weeks
  const weeks: ReturnType<typeof buildWeekGrids> = []
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() + w * 7)

    const days: (typeof weeks)[0]['days'] = []
    let hasVisits = false
    for (let d = 0; d < 5; d++) {
      const dayDate = new Date(weekStart)
      dayDate.setDate(weekStart.getDate() + d)
      const key = formatDateKey(dayDate)
      const dayVisits = byDate.get(key) || []
      if (dayVisits.length > 0) hasVisits = true
      days.push({
        date: key,
        dayName: WEEKDAYS[d],
        dayNum: dayDate.getDate(),
        monthShort: dayDate.toLocaleDateString('en-GB', { month: 'short' }),
        isToday: key === todayKey,
        visits: dayVisits,
      })
    }

    // Only include weeks that have at least one visit (except current week always shows)
    if (hasVisits || w === 0) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 4)
      const label = w === 0 ? 'This Week' : w === 1 ? 'Next Week'
        : `${weekStart.getDate()} ${weekStart.toLocaleDateString('en-GB', { month: 'short' })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('en-GB', { month: 'short' })}`
      weeks.push({ weekLabel: label, weekStart, days })
    }
  }

  return weeks
}

export default async function PortalDashboardPage() {
  const ctx = await requirePortalSession()
  const [data, schedule] = await Promise.all([
    getPortalDashboard(ctx),
    getPortalDashboardSchedule(ctx),
  ])

  const weekGrids = buildWeekGrids(schedule.upcomingVisits)

  return (
    <div>
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome, {ctx.displayName.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ctx.customerName} &mdash; Customer Portal</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <StatCard label="Open Tickets" value={data.openTickets} href="/portal/helpdesk" color="#ef4444" />
        <StatCard label="Pending Quotes" value={data.pendingQuotes} href="/portal/quotes" color="#f59e0b" />
        <StatCard label="Unpaid Invoices" value={data.unpaidInvoices} href="/portal/invoices" color="#8b5cf6" />
        <StatCard label="Upcoming Visits" value={data.upcomingVisits} href="/portal/visits" color="#6366f1" />
        <StatCard label="Active Contracts" value={data.activeContracts} href="/portal/contracts" color="#10b981" />
      </div>

      {/* Contract Summary + Visit Schedule */}
      {schedule.contracts.length > 0 && (
        <div className="mb-10 space-y-6">
          {/* Contract cards row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.contracts.map((contract) => (
              <ContractSummaryCard key={contract.id} contract={contract} />
            ))}
          </div>

          {/* Week schedule grid */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Visit Schedule</h2>
              <Link href="/portal/visits" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline no-underline">
                View all
              </Link>
            </div>

            {weekGrids.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">No upcoming visits scheduled</div>
            ) : (
              <div className="p-5 space-y-6">
                {weekGrids.map((week) => (
                  <div key={week.weekLabel}>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{week.weekLabel}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {week.days.map((day) => (
                        <div
                          key={day.date}
                          className={`rounded-lg border min-h-[80px] ${
                            day.isToday
                              ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                              : day.visits.length > 0
                                ? 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'
                                : 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                          }`}
                        >
                          {/* Day header */}
                          <div className={`px-2 py-1.5 text-center border-b ${
                            day.isToday
                              ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-100/50 dark:bg-indigo-500/15'
                              : 'border-slate-100 dark:border-slate-700'
                          }`}>
                            <div className={`text-[10px] font-medium uppercase ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{day.dayName}</div>
                            <div className={`text-sm font-bold leading-tight ${day.isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{day.dayNum}</div>
                          </div>

                          {/* Visit blocks */}
                          <div className="p-1.5 space-y-1">
                            {day.visits.map((visit) => (
                              <VisitBlock key={visit.id} visit={visit} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.recentActivity.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">No recent activity</div>
            ) : (
              data.recentActivity.map((item, i) => (
                <Link
                  key={i}
                  href={item.link}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs ${
                    item.type === 'ticket' ? 'bg-red-500' :
                    item.type === 'quote' ? 'bg-amber-500' :
                    item.type === 'invoice' ? 'bg-violet-500' :
                    item.type === 'visit' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}>
                    {item.type === 'ticket' ? 'T' :
                     item.type === 'quote' ? 'Q' :
                     item.type === 'invoice' ? 'I' :
                     item.type === 'visit' ? 'V' : 'O'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.description}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(item.date)}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="p-5 space-y-3">
            <Link
              href="/portal/helpdesk/new"
              className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
            >
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Raise a Support Ticket
            </Link>
            <Link
              href="/portal/quotes?status=sent"
              className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
            >
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              View Open Quotes
            </Link>
            <Link
              href="/portal/orders"
              className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
            >
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-1.036-.84-1.875-1.875-1.875H5.625A1.875 1.875 0 013.75 15.75v1.5c0 .621.504 1.125 1.125 1.125H5.25" />
              </svg>
              Track My Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, href, color }: { label: string; value: number; href: string; color: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:shadow-sm transition-shadow no-underline">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
    </Link>
  )
}

function ContractSummaryCard({ contract }: { contract: PortalContractSummary }) {
  return (
    <Link href={`/portal/contracts/${contract.id}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:shadow-sm transition-shadow no-underline block">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{contract.contractType}</div>
          <div className="text-xs text-slate-400">{contract.contractNumber}</div>
        </div>
      </div>

      {contract.visitSlots.length > 0 ? (
        <div className="space-y-1.5">
          {contract.visitSlots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1.5">
              <svg className="h-3.5 w-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{slot.dayOfWeek}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{slot.timeDisplay}</span>
              {slot.engineerName && (
                <span className="text-[10px] text-slate-400">{slot.engineerName}</span>
              )}
              {slot.cycleWeekNumbers.length > 0 && slot.cycleWeekNumbers.length < 4 && (
                <span className="text-[10px] text-slate-400">Wk {slot.cycleWeekNumbers.join(',')}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No visit slots configured</p>
      )}
    </Link>
  )
}

const VISIT_BLOCK_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  draft: { border: 'border-amber-200 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' },
  confirmed: { border: 'border-green-200 dark:border-green-700', bg: 'bg-green-50 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-300' },
  completed: { border: 'border-blue-200 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300' },
  rescheduled: { border: 'border-purple-200 dark:border-purple-700', bg: 'bg-purple-50 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300' },
  bank_holiday_pending: { border: 'border-orange-200 dark:border-orange-700', bg: 'bg-orange-50 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300' },
}

const VISIT_BLOCK_LABELS: Record<string, string> = {
  draft: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  rescheduled: 'Rescheduled',
  bank_holiday_pending: 'Bank Holiday',
}

function getVisitTimeLabel(visit: PortalDashboardVisit): string {
  if (visit.startTime && visit.endTime) {
    return `${visit.startTime.slice(0, 5)}–${visit.endTime.slice(0, 5)}`
  }
  if (visit.timeSlot === 'am') return '08:30–12:00'
  if (visit.timeSlot === 'pm') return '12:30–16:00'
  return '08:30–16:00'
}

function VisitBlock({ visit }: { visit: PortalDashboardVisit }) {
  const style = VISIT_BLOCK_STYLES[visit.status] || VISIT_BLOCK_STYLES.draft
  const timeLabel = getVisitTimeLabel(visit)
  const statusLabel = VISIT_BLOCK_LABELS[visit.status] || visit.status

  return (
    <div className={`rounded-md border px-2 py-1.5 text-[11px] leading-tight ${style.border} ${style.bg}`}>
      <div className={`font-semibold ${style.text}`}>{timeLabel}</div>
      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium mt-0.5 ${style.text} ${style.bg}`}>
        {statusLabel}
      </span>
      {visit.engineerNames.length > 0 && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {visit.engineerNames.join(', ')}
        </div>
      )}
      {visit.contractType && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{visit.contractType}</div>
      )}
    </div>
  )
}
