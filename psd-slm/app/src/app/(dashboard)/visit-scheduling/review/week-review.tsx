'use client'

import { useState, useEffect, useTransition } from 'react'
import { getEngineerWeekView, confirmEngineerVisits, getHolidaysForRange } from '../actions'
import { DAY_SHORT_NAMES, DAY_INDEX_TO_KEY, formatVisitDate } from '@/lib/visit-scheduling/types'
import { Button } from '@/components/ui/button'
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
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  // Week state
  const [weekStart, setWeekStart] = useState(formatDate(getMonday(new Date())))
  const [weekData, setWeekData] = useState<EngineerWeekViewType[]>([])

  // Month state
  const now = new Date()
  const [monthYear, setMonthYear] = useState(now.getFullYear())
  const [monthNum, setMonthNum] = useState(now.getMonth() + 1)

  const [loading, setLoading] = useState(false)
  const [confirmResult, setConfirmResult] = useState<string | null>(null)

  // Bulk validate state
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkValidating, setBulkValidating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' })
  const [bulkResult, setBulkResult] = useState<{ totalConfirmed: number; totalJobs: number; errors: string[] } | null>(null)

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

  // Bulk validate all visible engineers
  const totalDraftCount = weekData.reduce(
    (acc, eng) => acc + eng.days.reduce((a, d) => a + d.visits.filter(v => v.status === 'draft').length, 0), 0
  )

  async function handleBulkValidate() {
    setShowBulkConfirm(false)
    setBulkValidating(true)
    setBulkResult(null)
    setConfirmResult(null)

    const engineersToConfirm = weekData.filter(eng =>
      eng.days.some(d => d.visits.some(v => v.status === 'draft'))
    )
    const total = engineersToConfirm.length
    setBulkProgress({ current: 0, total, currentName: '' })

    let totalConfirmed = 0
    let totalJobs = 0
    const errors: string[] = []

    for (let i = 0; i < engineersToConfirm.length; i++) {
      const eng = engineersToConfirm[i]
      setBulkProgress({ current: i + 1, total, currentName: eng.engineer_name })

      const res = await confirmEngineerVisits(eng.engineer_id, weekStart)
      if (res.error) {
        errors.push(`${eng.engineer_name}: ${res.error}`)
      } else {
        totalConfirmed += res.count || 0
        totalJobs += res.jobsCreated || 0
      }
    }

    setBulkResult({ totalConfirmed, totalJobs, errors })
    setBulkValidating(false)

    // Refresh data
    if (selectedEngineers.length > 0) {
      const data = await getEngineerWeekView(selectedEngineers, weekStart)
      setWeekData(data)
    }
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
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
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

        <div className="flex items-center gap-2">
          {/* Validate All button */}
          {viewMode === 'week' && totalDraftCount > 0 && !bulkValidating && (
            <Button
              onClick={() => setShowBulkConfirm(true)}
              variant="orange"
              size="sm"
            >
              Validate All Visible ({totalDraftCount})
            </Button>
          )}

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
      </div>

      {/* Engineer toggles */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
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

      {/* Bulk validation progress */}
      {bulkValidating && (
        <div className="mb-6 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Validating visits... {bulkProgress.currentName && `(${bulkProgress.currentName})`}
            </span>
            <span className="text-xs text-orange-500 dark:text-orange-400">
              {bulkProgress.current} / {bulkProgress.total} engineers
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-orange-200 dark:bg-orange-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: bulkProgress.total > 0 ? `${(bulkProgress.current / bulkProgress.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Bulk validation result */}
      {bulkResult && !bulkValidating && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          bulkResult.errors.length > 0
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-green-200 bg-green-50 text-green-700'
        }`}>
          <div className="font-medium">
            Validated {bulkResult.totalConfirmed} visit{bulkResult.totalConfirmed !== 1 ? 's' : ''}
            {bulkResult.totalJobs > 0 && ` — ${bulkResult.totalJobs} job${bulkResult.totalJobs !== 1 ? 's' : ''} created`}
          </div>
          {bulkResult.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside text-xs">
              {bulkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Bulk confirm modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Validate All Visible Visits</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              This will confirm <span className="font-semibold">{totalDraftCount} draft visit{totalDraftCount !== 1 ? 's' : ''}</span> across{' '}
              <span className="font-semibold">{weekData.filter(e => e.days.some(d => d.visits.some(v => v.status === 'draft'))).length} engineer{weekData.filter(e => e.days.some(d => d.visits.some(v => v.status === 'draft'))).length !== 1 ? 's' : ''}</span> for the visible week and create associated jobs.
            </p>
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 mb-4">
              This may take some time depending on the number of visits. Please do not navigate away while validation is in progress.
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="default" size="sm" onClick={() => setShowBulkConfirm(false)}>
                Cancel
              </Button>
              <Button variant="orange" size="sm" onClick={handleBulkValidate}>
                Validate All
              </Button>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
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
                  <Button
                    onClick={() => onConfirmAll(eng.engineer_id)}
                    variant="success"
                    size="sm"
                    disabled={isPending}
                  >
                    Confirm All ({draftCount})
                  </Button>
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
