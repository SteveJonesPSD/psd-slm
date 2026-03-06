'use client'

import { useState, useMemo } from 'react'
import type { PortalVisit } from '@/lib/portal/types'

const STATUS_STYLES: Record<string, { label: string; border: string; bg: string; text: string }> = {
  draft: { label: 'Scheduled', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  confirmed: { label: 'Confirmed', border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700' },
  completed: { label: 'Completed', border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  rescheduled: { label: 'Rescheduled', border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
  bank_holiday_pending: { label: 'Bank Holiday', border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-700' },
}

const SLOT_LABELS: Record<string, string> = { am: 'AM', pm: 'PM', custom: 'Full Day' }
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getDisplayTime(visit: PortalVisit): string | null {
  if (visit.startTime && visit.endTime) {
    return `${visit.startTime.slice(0, 5)}–${visit.endTime.slice(0, 5)}`
  }
  if (visit.timeSlot === 'am') return '08:30–12:00'
  if (visit.timeSlot === 'pm') return '12:30–16:00'
  if (visit.timeSlot === 'custom') return '08:30–16:00'
  return null
}

export function PortalVisitsGrid({ visits }: { visits: PortalVisit[] }) {
  const [weekStart, setWeekStart] = useState(() => fmtDate(getMonday(new Date())))

  const weekDays = useMemo(() => {
    const days: string[] = []
    const start = new Date(weekStart + 'T12:00:00')
    for (let i = 0; i < 5; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(fmtDate(d))
    }
    return days
  }, [weekStart])

  const visitsByDate = useMemo(() => {
    const map = new Map<string, PortalVisit[]>()
    for (const v of visits) {
      const existing = map.get(v.scheduledDate) || []
      existing.push(v)
      map.set(v.scheduledDate, existing)
    }
    return map
  }, [visits])

  const weekEnd = weekDays[4]
  const weekEndDisplay = new Date(weekStart + 'T12:00:00')
  weekEndDisplay.setDate(weekEndDisplay.getDate() + 4)
  const weekLabel = `${fmtShort(weekStart)} – ${fmtShort(fmtDate(weekEndDisplay))}`
  const weekVisitCount = weekDays.reduce((acc, d) => acc + (visitsByDate.get(d)?.length || 0), 0)
  const today = fmtDate(new Date())

  function navigateWeek(offset: number) {
    const current = new Date(weekStart + 'T12:00:00')
    current.setDate(current.getDate() + offset * 7)
    setWeekStart(fmtDate(current))
  }

  // Upcoming weeks beyond current view
  const upcomingWeeks = useMemo(() => {
    const future = visits.filter((v) =>
      v.scheduledDate > weekEnd && (v.status === 'draft' || v.status === 'confirmed')
    )
    const groups = new Map<string, number>()
    for (const v of future) {
      const mon = fmtDate(getMonday(new Date(v.scheduledDate + 'T12:00:00')))
      groups.set(mon, (groups.get(mon) || 0) + 1)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 4)
  }, [visits, weekEnd])

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          >
            &larr;
          </button>
          <button
            onClick={() => setWeekStart(fmtDate(getMonday(new Date())))}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          >
            This Week
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          >
            &rarr;
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-2">{weekLabel}</span>
          {weekVisitCount > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({weekVisitCount} visit{weekVisitCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>

      {/* Week Grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[700px]">
            <thead>
              <tr>
                {weekDays.map((date, i) => {
                  const isToday = date === today
                  return (
                    <th
                      key={date}
                      className={`whitespace-nowrap border-b border-slate-200 dark:border-slate-700 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-left w-1/5 ${
                        isToday
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {DAY_NAMES[i]}{' '}
                      <span className={`font-normal ${isToday ? 'text-indigo-400 dark:text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {fmtShort(date)}
                      </span>
                      {isToday && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDays.map((date) => {
                  const dayVisits = visitsByDate.get(date) || []
                  const isToday = date === today
                  return (
                    <td
                      key={date}
                      className={`px-2 py-2 align-top border-r border-slate-100 dark:border-slate-700 last:border-r-0 ${
                        isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                      }`}
                    >
                      {dayVisits.length === 0 ? (
                        <div className="text-center py-8">
                          <span className="text-xs text-slate-300 dark:text-slate-600">No visits</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayVisits.map((visit) => (
                            <VisitCard key={visit.id} visit={visit} />
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming weeks */}
      {upcomingWeeks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Upcoming Weeks</h2>
          <div className="space-y-2">
            {upcomingWeeks.map(([monday, count]) => {
              const fri = new Date(monday + 'T12:00:00')
              fri.setDate(fri.getDate() + 4)
              const label = `${fmtShort(monday)} – ${fmtShort(fmtDate(fri))}`
              return (
                <button
                  key={monday}
                  onClick={() => setWeekStart(monday)}
                  className="flex items-center justify-between w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {count} visit{count !== 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function VisitCard({ visit }: { visit: PortalVisit }) {
  const style = STATUS_STYLES[visit.status] || STATUS_STYLES.draft
  const time = getDisplayTime(visit)

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} dark:bg-opacity-20 px-2.5 py-2 text-xs`}>
      {time && (
        <div className={`text-[11px] font-semibold ${style.text}`}>{time}</div>
      )}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${style.text} ${style.bg}`}>
          {style.label}
        </span>
        {SLOT_LABELS[visit.timeSlot] && (
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
            {SLOT_LABELS[visit.timeSlot]}
          </span>
        )}
      </div>
      {visit.engineerName && (
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{visit.engineerName}</div>
      )}
      {visit.contractReference && (
        <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{visit.contractReference}</div>
      )}
    </div>
  )
}
