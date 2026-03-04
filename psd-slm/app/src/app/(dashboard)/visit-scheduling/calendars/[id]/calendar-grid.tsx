'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VisitCalendarWeek, BankHoliday } from '@/lib/visit-scheduling/types'
import { formatVisitDate } from '@/lib/visit-scheduling/types'
import {
  updateCalendarWeek,
  recalculateCycleNumbers,
  activateCalendar,
  archiveCalendar,
  deleteCalendar,
} from '../../actions'

const CYCLE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed']

interface CalendarGridProps {
  calendarId: string
  calendarStatus: string
  weeks: VisitCalendarWeek[]
  bankHolidays: BankHoliday[]
}

export function CalendarGrid({ calendarId, calendarStatus, weeks, bankHolidays }: CalendarGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const bankHolidayDates = new Set(bankHolidays.map(h => h.holiday_date))
  const bankHolidayNames = new Map(bankHolidays.map(h => [h.holiday_date, h.name]))

  function weekHasBankHoliday(weekStartDate: string) {
    const start = new Date(weekStartDate + 'T00:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + 4) // Monday to Friday
    const results: string[] = []
    const current = new Date(start)
    while (current <= end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      if (bankHolidayDates.has(dateStr)) {
        results.push(bankHolidayNames.get(dateStr) || dateStr)
      }
      current.setDate(current.getDate() + 1)
    }
    return results
  }

  async function handleToggleHoliday(weekId: string, currentHoliday: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await updateCalendarWeek(weekId, {
        is_holiday: !currentHoliday,
        holiday_name: !currentHoliday ? 'School Holiday' : null,
      })
      if (res.error) { setError(res.error); return }
      await recalculateCycleNumbers(calendarId)
      router.refresh()
    })
  }

  async function handleActivate() {
    setError(null)
    startTransition(async () => {
      const res = await activateCalendar(calendarId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  async function handleArchive() {
    setError(null)
    startTransition(async () => {
      const res = await archiveCalendar(calendarId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this calendar? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const res = await deleteCalendar(calendarId)
      if (res.error) setError(res.error)
      else router.push('/visit-scheduling/calendars')
    })
  }

  const isEditable = calendarStatus === 'draft' || calendarStatus === 'active'

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {calendarStatus === 'draft' && (
          <button
            onClick={handleActivate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Activate Calendar
          </button>
        )}
        {calendarStatus === 'active' && (
          <button
            onClick={handleArchive}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Archive Calendar
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
        >
          Delete Calendar
        </button>
        {isPending && <span className="text-xs text-slate-400">Saving...</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Week grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full border-collapse text-sm min-w-[700px]">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-left w-16">Wk</th>
              <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-left">Week Commencing</th>
              <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center w-20">Cycle</th>
              <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center w-20">Holiday</th>
              <th className="whitespace-nowrap border-b-2 border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-left">Bank Holidays</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(week => {
              const bhInWeek = weekHasBankHoliday(week.week_start_date)

              return (
                <tr
                  key={week.id}
                  className={`border-b border-slate-100 dark:border-slate-700 ${week.is_holiday ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''}`}
                >
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-center">{week.sort_order}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {formatVisitDate(week.week_start_date)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {week.cycle_week_number !== null ? (
                      <span
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: CYCLE_COLORS[(week.cycle_week_number - 1) % CYCLE_COLORS.length] }}
                      >
                        {week.cycle_week_number}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {isEditable ? (
                      <input
                        type="checkbox"
                        checked={week.is_holiday}
                        onChange={() => handleToggleHoliday(week.id, week.is_holiday)}
                        disabled={isPending}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                      />
                    ) : (
                      week.is_holiday ? (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">Holiday</span>
                      ) : null
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {bhInWeek.length > 0 ? (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">{bhInWeek.join(', ')}</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
