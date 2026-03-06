import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, VISIT_STATUS_CONFIG, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { getVisitStats, getEngineerWeekView, getFieldEngineers } from './actions'
import { DAY_SHORT_NAMES, DAY_INDEX_TO_KEY } from '@/lib/visit-scheduling/types'

export default async function VisitSchedulingPage() {
  const [stats, engineers] = await Promise.all([
    getVisitStats(),
    getFieldEngineers(),
  ])

  // Get this week's Monday
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(monday.getDate() + mondayOffset)
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  // Generate weekday dates (Mon–Fri) for column headers
  const weekDayDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      dayIndex: i + 1,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
  })

  const engineerIds = engineers.map(e => e.id)
  let weekView: Awaited<ReturnType<typeof getEngineerWeekView>> = []
  if (engineerIds.length > 0) {
    weekView = await getEngineerWeekView(engineerIds, weekStart)
  }

  return (
    <div>
      <PageHeader
        title="SchoolCare Visit Calendar"
        subtitle="Recurring visit scheduling for education contracts"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/visit-scheduling/generate">
              <Button size="sm" variant="success">Generate Visits</Button>
            </Link>
            <Link href="/visit-scheduling/calendars">
              <Button size="sm">Calendars</Button>
            </Link>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Today's Visits"
          value={stats.todayCount}
          accent="#2563eb"
        />
        <StatCard
          label="This Week"
          value={stats.weekCount}
          accent="#6366f1"
        />
        <StatCard
          label="Unconfirmed"
          value={stats.unconfirmedCount}
          accent={stats.unconfirmedCount > 0 ? '#d97706' : undefined}
        />
        <StatCard
          label="Bank Holiday Pending"
          value={stats.bankHolidayPending}
          accent={stats.bankHolidayPending > 0 ? '#dc2626' : undefined}
        />
      </div>

      {/* This week's schedule grid */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">This Week&apos;s Schedule</h3>
          <Link
            href="/visit-scheduling/review"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 no-underline"
          >
            Full Review →
          </Link>
        </div>

        {weekView.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No engineers configured. Add visit slots on contracts to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[700px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-left w-36">
                    Engineer
                  </th>
                  {weekDayDates.map(d => (
                    <th
                      key={d.dayIndex}
                      className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-left"
                    >
                      {DAY_SHORT_NAMES[DAY_INDEX_TO_KEY[d.dayIndex]]}{' '}
                      <span className="font-normal text-slate-400 dark:text-slate-500">{d.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekView.map(eng => (
                  <tr key={eng.engineer_id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: eng.engineer_color || '#6366f1' }}
                        >
                          {eng.engineer_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{eng.engineer_name}</span>
                      </div>
                    </td>
                    {eng.days.map(day => (
                      <td key={day.date} className="px-3 py-2.5 align-top">
                        {day.visits.length === 0 ? (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <div className="space-y-1">
                            {day.visits.map(visit => {
                              const statusCfg = VISIT_STATUS_CONFIG[visit.status]
                              const slotCfg = TIME_SLOT_CONFIG[visit.time_slot]
                              return (
                                <div
                                  key={visit.id}
                                  className="rounded-md border px-2 py-1.5 text-xs dark:!bg-slate-700/60"
                                  style={{
                                    borderColor: statusCfg?.color || '#e2e8f0',
                                    backgroundColor: statusCfg?.bg || '#f8fafc',
                                  }}
                                >
                                  <div className="font-medium text-slate-700 dark:text-slate-100 truncate max-w-[140px]">
                                    {visit.customer_name}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {slotCfg && <Badge label={slotCfg.label} color={slotCfg.color} bg={slotCfg.bg} className="text-[9px] px-1.5 py-0" />}
                                    {visit.is_bank_holiday && (
                                      <span className="text-[9px] text-red-600 font-medium">BH</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <Link href="/visit-scheduling/calendars" className="no-underline">
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all">
            <div className="text-lg mb-1">📅</div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Manage Calendars</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create and configure academic year calendars with holiday weeks</p>
          </div>
        </Link>
        <Link href="/visit-scheduling/review" className="no-underline">
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all">
            <div className="text-lg mb-1">✅</div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Week Review</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review and confirm upcoming visits by engineer</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
