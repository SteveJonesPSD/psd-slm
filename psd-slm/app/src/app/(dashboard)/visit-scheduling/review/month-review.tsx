'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { getEngineerMonthView, confirmEngineerMonthVisits, getHolidaysForRange } from '../actions'
import { Badge, VISIT_STATUS_CONFIG, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VisitInstanceWithDetails, EngineerMonthView } from '@/lib/visit-scheduling/types'

interface MonthReviewProps {
  engineers: { id: string; first_name: string; last_name: string; color: string | null }[]
  selectedEngineers: string[]
  year: number
  month: number
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Build a Mon–Fri grid for the given month. Each week row has 5 cells (some null for padding). */
function getMonthGrid(year: number, month: number): { date: string | null; dayNum: number | null }[][] {
  const weeks: { date: string | null; dayNum: number | null }[][] = []
  const lastDay = new Date(year, month, 0).getDate()

  let currentWeek: { date: string | null; dayNum: number | null }[] = []

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay() // 0=Sun..6=Sat
    if (dow === 0 || dow === 6) continue

    const workDow = dow - 1 // Mon=0..Fri=4
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    // New week row on Monday
    if (workDow === 0 && currentWeek.length > 0) {
      while (currentWeek.length < 5) currentWeek.push({ date: null, dayNum: null })
      weeks.push(currentWeek)
      currentWeek = []
    }

    // Pad leading days if first week doesn't start on Monday
    if (currentWeek.length === 0 && workDow > 0 && weeks.length === 0) {
      for (let pad = 0; pad < workDow; pad++) {
        currentWeek.push({ date: null, dayNum: null })
      }
    }

    currentWeek.push({ date: dateStr, dayNum: d })
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 5) currentWeek.push({ date: null, dayNum: null })
    weeks.push(currentWeek)
  }

  return weeks
}

export function MonthReview({ engineers, selectedEngineers, year, month }: MonthReviewProps) {
  const [isPending, startTransition] = useTransition()
  const [monthData, setMonthData] = useState<EngineerMonthView[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmResult, setConfirmResult] = useState<string | null>(null)

  // Holiday data
  const [schoolHolidayDates, setSchoolHolidayDates] = useState<Map<string, string>>(new Map())
  const [bankHolidayMap, setBankHolidayMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (selectedEngineers.length === 0) {
      setMonthData([])
      setLoading(false)
      return
    }
    setLoading(true)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    Promise.all([
      getEngineerMonthView(selectedEngineers, year, month),
      getHolidaysForRange(startDate, endDate),
    ])
      .then(([data, holidays]) => {
        setMonthData(data)
        // Expand school holiday weeks into Mon-Fri dates
        const schoolMap = new Map<string, string>()
        for (const hw of holidays.schoolHolidayWeeks) {
          for (let i = 0; i < 5; i++) {
            const d = new Date(hw.week_start_date + 'T12:00:00')
            d.setDate(d.getDate() + i)
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            schoolMap.set(ds, hw.holiday_name || 'School Holiday')
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
  }, [selectedEngineers, year, month])

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const today = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  async function handleConfirmAll(engineerId: string) {
    setConfirmResult(null)
    startTransition(async () => {
      const res = await confirmEngineerMonthVisits(engineerId, year, month)
      if (res.error) {
        setConfirmResult(`Error: ${res.error}`)
      } else {
        const jobsMsg = res.jobsCreated ? ` (${res.jobsCreated} job${res.jobsCreated === 1 ? '' : 's'} created)` : ''
        setConfirmResult(`Confirmed ${res.count} visit${res.count === 1 ? '' : 's'} for ${MONTH_NAMES[month - 1]}${jobsMsg}`)
        const data = await getEngineerMonthView(selectedEngineers, year, month)
        setMonthData(data)
      }
    })
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-400">
        Loading month schedule...
      </div>
    )
  }

  if (monthData.length === 0) {
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

      <div className="space-y-4">
        {monthData.map(eng => {
          const draftCount = eng.visits.filter(v => v.status === 'draft').length
          const totalCount = eng.visits.length

          return (
            <div key={eng.engineer_id} className="rounded-xl border border-gray-200 bg-white">
              {/* Engineer header */}
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
                    {totalCount} visit{totalCount !== 1 ? 's' : ''} in {MONTH_NAMES[month - 1]}
                  </span>
                </div>
                {draftCount > 0 && (
                  <Button
                    onClick={() => handleConfirmAll(eng.engineer_id)}
                    variant="success"
                    size="sm"
                    disabled={isPending}
                  >
                    Confirm All ({draftCount})
                  </Button>
                )}
              </div>

              {/* Month calendar grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs min-w-[600px]">
                  <thead>
                    <tr>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                        <th
                          key={day}
                          className="border-b border-gray-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left w-1/5"
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((week, wi) => (
                      <tr key={wi}>
                        {week.map((cell, ci) => {
                          if (!cell.date) {
                            return <td key={ci} className="border-r border-b border-slate-100 last:border-r-0 p-1 bg-slate-50/50" />
                          }

                          const dayVisits = eng.visits.filter(v => v.visit_date === cell.date)
                          const isToday = cell.date === today
                          const isSchoolHoliday = schoolHolidayDates.has(cell.date)
                          const isBankHoliday = bankHolidayMap.has(cell.date)
                          const isHoliday = isSchoolHoliday || isBankHoliday

                          return (
                            <td
                              key={ci}
                              className={`border-r border-b border-slate-100 last:border-r-0 p-1 align-top min-h-[56px] ${
                                isToday ? 'bg-indigo-50/40' : isHoliday ? 'bg-amber-50/60' : ''
                              }`}
                            >
                              <div className={`text-[10px] mb-0.5 ${isToday ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                                {cell.dayNum}
                              </div>
                              {isBankHoliday && (
                                <div className="text-[9px] text-amber-600 font-medium truncate mb-0.5">
                                  {bankHolidayMap.get(cell.date)}
                                </div>
                              )}
                              {isSchoolHoliday && !isBankHoliday && dayVisits.length === 0 && (
                                <div className="text-[9px] text-amber-600 truncate">
                                  {schoolHolidayDates.get(cell.date)}
                                </div>
                              )}
                              <div className="space-y-0.5">
                                {dayVisits.map(visit => (
                                  <MonthVisitBlock key={visit.id} visit={visit} columnIndex={ci} />
                                ))}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              {totalCount > 0 && (
                <div className="px-5 py-2 border-t border-slate-100 flex gap-4 flex-wrap">
                  {['draft', 'confirmed', 'completed', 'bank_holiday_pending'].map(status => {
                    const cfg = VISIT_STATUS_CONFIG[status]
                    if (!cfg) return null
                    const count = eng.visits.filter(v => v.status === status).length
                    if (count === 0) return null
                    return (
                      <span key={status} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label} ({count})
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthVisitBlock({ visit, columnIndex }: { visit: VisitInstanceWithDetails; columnIndex: number }) {
  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
  const slotCfg = TIME_SLOT_CONFIG[visit.time_slot]

  // Position tooltip on left for rightmost columns (Thu=3, Fri=4) to avoid overflow
  const tooltipAlign = columnIndex >= 3 ? 'right-0' : 'left-0'

  return (
    <div className="group relative">
      <div
        className="rounded px-1 py-0.5 text-[9px] font-medium truncate cursor-default"
        style={{
          color: statusCfg?.color || '#6b7280',
          backgroundColor: statusCfg?.bg || '#f3f4f6',
          borderLeft: `2px solid ${statusCfg?.color || '#6b7280'}`,
        }}
      >
        {visit.customer_name}
      </div>

      {/* Hover tooltip */}
      <div className={`hidden group-hover:block absolute z-30 ${tooltipAlign} top-full mt-1 w-52 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-2.5 shadow-lg text-[11px]`}>
        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{visit.customer_name}</div>
        <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 w-12">Status</span>
            {statusCfg && (
              <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} className="text-[9px] px-1.5 py-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 w-12">Slot</span>
            {slotCfg && (
              <Badge label={slotCfg.label} color={slotCfg.color} bg={slotCfg.bg} className="text-[9px] px-1.5 py-0" />
            )}
            {visit.start_time && visit.end_time && (
              <span>{visit.start_time.slice(0, 5)}–{visit.end_time.slice(0, 5)}</span>
            )}
          </div>
          {visit.contract_number && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500 w-12">Contract</span>
              <span>{visit.contract_number}</span>
            </div>
          )}
          {visit.job_id && visit.job_number && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500 w-12">Job</span>
              <a
                href={`/scheduling/jobs/${visit.job_id}`}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {visit.job_number}
              </a>
            </div>
          )}
          {visit.is_bank_holiday && (
            <div className="text-red-600 font-semibold mt-0.5">Bank Holiday</div>
          )}
        </div>
      </div>
    </div>
  )
}
