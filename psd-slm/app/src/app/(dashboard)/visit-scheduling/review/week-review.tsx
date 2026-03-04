'use client'

import { useState, useEffect, useTransition } from 'react'
import { getEngineerWeekView, confirmEngineerVisits, getHolidaysForRange } from '../actions'
import { DAY_SHORT_NAMES, DAY_INDEX_TO_KEY, formatVisitDate } from '@/lib/visit-scheduling/types'
import type { EngineerWeekView as EngineerWeekViewType } from '@/lib/visit-scheduling/types'
import { VisitCard } from './visit-card'
import { MonthReview } from './month-review'

interface WeekReviewProps {
  engineers: { id: string; first_name: string; last_name: string; color: string | null }[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function WeekReview({ engineers }: WeekReviewProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>(engineers.map(e => e.id))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  // Week state
  const [weekStart, setWeekStart] = useState(formatDate(getMonday(new Date())))
  const [weekData, setWeekData] = useState<EngineerWeekViewType[]>([])

  // Month state
  const now = new Date()
  const [monthYear, setMonthYear] = useState(now.getFullYear())
  const [monthNum, setMonthNum] = useState(now.getMonth() + 1)

  const [loading, setLoading] = useState(true)
  const [confirmResult, setConfirmResult] = useState<string | null>(null)

  // Holiday data
  const [schoolHolidayDates, setSchoolHolidayDates] = useState<Map<string, string>>(new Map())
  const [bankHolidayMap, setBankHolidayMap] = useState<Map<string, string>>(new Map())

  // Load week data + holidays
  useEffect(() => {
    if (viewMode !== 'week') return
    if (selectedEngineers.length === 0) {
      setWeekData([])
      setLoading(false)
      return
    }
    setLoading(true)
    const weekEnd = new Date(weekStart + 'T12:00:00')
    weekEnd.setDate(weekEnd.getDate() + 4)
    const weekEndStr = formatDate(weekEnd)

    Promise.all([
      getEngineerWeekView(selectedEngineers, weekStart),
      getHolidaysForRange(weekStart, weekEndStr),
    ])
      .then(([data, holidays]) => {
        setWeekData(data)
        // Expand school holiday weeks into Mon-Fri dates
        const schoolMap = new Map<string, string>()
        for (const hw of holidays.schoolHolidayWeeks) {
          for (let i = 0; i < 5; i++) {
            const d = new Date(hw.week_start_date + 'T12:00:00')
            d.setDate(d.getDate() + i)
            schoolMap.set(formatDate(d), hw.holiday_name || 'School Holiday')
          }
        }
        setSchoolHolidayDates(schoolMap)
        const bankMap = new Map<string, string>()
        for (const bh of holidays.bankHolidays) {
          bankMap.set(bh.holiday_date, bh.name)
        }
        setBankHolidayMap(bankMap)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedEngineers, weekStart, viewMode])

  // Week navigation
  function navigateWeek(offset: number) {
    const current = new Date(weekStart + 'T12:00:00')
    current.setDate(current.getDate() + offset * 7)
    setWeekStart(formatDate(current))
    setConfirmResult(null)
  }

  function goToThisWeek() {
    setWeekStart(formatDate(getMonday(new Date())))
    setConfirmResult(null)
  }

  function handleDatePick(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    if (viewMode === 'week') {
      const picked = new Date(val + 'T12:00:00')
      setWeekStart(formatDate(getMonday(picked)))
    } else {
      const picked = new Date(val + 'T12:00:00')
      setMonthYear(picked.getFullYear())
      setMonthNum(picked.getMonth() + 1)
    }
    setConfirmResult(null)
  }

  // Month navigation
  function navigateMonth(offset: number) {
    let m = monthNum + offset
    let y = monthYear
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonthNum(m)
    setMonthYear(y)
    setConfirmResult(null)
  }

  function goToThisMonth() {
    const n = new Date()
    setMonthYear(n.getFullYear())
    setMonthNum(n.getMonth() + 1)
    setConfirmResult(null)
  }

  function toggleEngineer(id: string) {
    setSelectedEngineers(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  // Week confirm
  async function handleConfirmAll(engineerId: string) {
    setConfirmResult(null)
    startTransition(async () => {
      const res = await confirmEngineerVisits(engineerId, weekStart)
      if (res.error) {
        setConfirmResult(`Error: ${res.error}`)
      } else {
        const jobsMsg = res.jobsCreated ? ` (${res.jobsCreated} job${res.jobsCreated === 1 ? '' : 's'} created)` : ''
        setConfirmResult(`Confirmed ${res.count} visit${res.count === 1 ? '' : 's'}${jobsMsg}`)
        const data = await getEngineerWeekView(selectedEngineers, weekStart)
        setWeekData(data)
      }
    })
  }

  // View switch — sync context when toggling
  function switchToWeek() {
    setViewMode('week')
    setConfirmResult(null)
  }

  function switchToMonth() {
    // Sync month to whatever week we're looking at
    const d = new Date(weekStart + 'T12:00:00')
    setMonthYear(d.getFullYear())
    setMonthNum(d.getMonth() + 1)
    setViewMode('month')
    setConfirmResult(null)
  }

  // Labels
  const weekEndDate = new Date(weekStart + 'T12:00:00')
  weekEndDate.setDate(weekEndDate.getDate() + 4)
  const weekLabel = `${new Date(weekStart + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} \u2013 ${weekEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${monthYear}`

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          {viewMode === 'week' ? (
            <>
              <button
                onClick={() => navigateWeek(-1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
              >
                &larr;
              </button>
              <button
                onClick={goToThisWeek}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                This Week
              </button>
              <button
                onClick={() => navigateWeek(1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
              >
                &rarr;
              </button>
              <span className="text-sm font-semibold text-slate-700 ml-2">{weekLabel}</span>
            </>
          ) : (
            <>
              <button
                onClick={() => navigateMonth(-1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
              >
                &larr;
              </button>
              <button
                onClick={goToThisMonth}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
              >
                &rarr;
              </button>
              <span className="text-sm font-semibold text-slate-700 ml-2">{monthLabel}</span>
            </>
          )}

          <input
            type="date"
            onChange={handleDatePick}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-slate-700 hover:bg-gray-50 cursor-pointer ml-1"
            title={viewMode === 'week' ? 'Jump to week containing this date' : 'Jump to month containing this date'}
          />
        </div>

        {/* Week / Month toggle */}
        <div className="flex gap-1 rounded-lg border border-gray-300 p-0.5">
          <button
            onClick={switchToWeek}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={switchToMonth}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Engineer toggles */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {engineers.map(eng => {
          const active = selectedEngineers.includes(eng.id)
          return (
            <button
              key={eng.id}
              onClick={() => toggleEngineer(eng.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <div
                className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: active ? (eng.color || '#6366f1') : '#cbd5e1' }}
              >
                {eng.first_name[0]}{eng.last_name[0]}
              </div>
              {eng.first_name} {eng.last_name}
            </button>
          )
        })}
      </div>

      {/* View content */}
      {viewMode === 'week' ? (
        <WeekGrid
          weekData={weekData}
          loading={loading}
          isPending={isPending}
          confirmResult={confirmResult}
          onConfirmAll={handleConfirmAll}
          schoolHolidayDates={schoolHolidayDates}
          bankHolidayMap={bankHolidayMap}
        />
      ) : (
        <MonthReview
          engineers={engineers}
          selectedEngineers={selectedEngineers}
          year={monthYear}
          month={monthNum}
        />
      )}
    </div>
  )
}

// ============================================================
// Week Grid (extracted from original inline JSX)
// ============================================================

function WeekGrid({
  weekData,
  loading,
  isPending,
  confirmResult,
  onConfirmAll,
  schoolHolidayDates,
  bankHolidayMap,
}: {
  weekData: EngineerWeekViewType[]
  loading: boolean
  isPending: boolean
  confirmResult: string | null
  onConfirmAll: (engineerId: string) => void
  schoolHolidayDates: Map<string, string>
  bankHolidayMap: Map<string, string>
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-400">
        Loading schedule...
      </div>
    )
  }

  if (weekData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-400">
        No engineers selected. Toggle engineers above to view their schedule.
      </div>
    )
  }

  return (
    <div>
      {confirmResult && (
        <div className={`mb-4 rounded-lg border px-4 py-2 text-sm ${
          confirmResult.startsWith('Error')
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-green-200 bg-green-50 text-green-700'
        }`}>
          {confirmResult}
        </div>
      )}

      {/* School holiday week banner */}
      {(() => {
        // Check if ALL days in the week are school holidays
        const firstEng = weekData[0]
        if (firstEng) {
          const allSchoolHoliday = firstEng.days.every(d => schoolHolidayDates.has(d.date))
          if (allSchoolHoliday) {
            const holidayName = schoolHolidayDates.get(firstEng.days[0]?.date) || 'School Holiday'
            return (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                School Holiday — {holidayName}
              </div>
            )
          }
        }
        return null
      })()}

      <div className="space-y-4">
        {weekData.map(eng => {
          const draftCount = eng.days.reduce(
            (acc, day) => acc + day.visits.filter(v => v.status === 'draft').length, 0
          )
          return (
            <div key={eng.engineer_id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: eng.engineer_color || '#6366f1' }}
                  >
                    {eng.engineer_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{eng.engineer_name}</h4>
                  <span className="text-xs text-slate-400">
                    {eng.days.reduce((acc, d) => acc + d.visits.length, 0)} visits this week
                  </span>
                </div>
                {draftCount > 0 && (
                  <button
                    onClick={() => onConfirmAll(eng.engineer_id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Confirm All ({draftCount})
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[700px]">
                  <thead>
                    <tr>
                      {eng.days.map(day => {
                        const bankHol = bankHolidayMap.get(day.date)
                        return (
                          <th
                            key={day.date}
                            className="whitespace-nowrap border-b border-gray-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left w-1/5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>
                                {DAY_SHORT_NAMES[DAY_INDEX_TO_KEY[day.day_of_week]] || `Day ${day.day_of_week}`}{' '}
                                <span className="font-normal text-slate-400">
                                  {formatVisitDate(day.date, { day: 'numeric', month: 'short' })}
                                </span>
                              </span>
                              {bankHol && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 normal-case tracking-normal">
                                  {bankHol}
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {eng.days.map(day => {
                        const isSchoolHoliday = schoolHolidayDates.has(day.date)
                        const isBankHoliday = bankHolidayMap.has(day.date)
                        const holidayLabel = bankHolidayMap.get(day.date) || schoolHolidayDates.get(day.date)
                        return (
                          <td
                            key={day.date}
                            className={`px-2 py-2 align-top border-r border-slate-100 last:border-r-0 ${
                              isSchoolHoliday || isBankHoliday ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            {day.visits.length === 0 ? (
                              <div className="text-center py-6">
                                {isSchoolHoliday || isBankHoliday ? (
                                  <span className="text-xs text-amber-500">{holidayLabel}</span>
                                ) : (
                                  <span className="text-xs text-slate-300">No visits</span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {day.visits.map(visit => (
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
          )
        })}
      </div>
    </div>
  )
}
