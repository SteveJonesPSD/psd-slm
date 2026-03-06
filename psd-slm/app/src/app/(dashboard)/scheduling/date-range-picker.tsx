'use client'

import { useState, useMemo } from 'react'

interface DateRangePickerProps {
  selectedDates: string[]
  workingDays: number[] // 1=Mon ... 7=Sun
  onDatesChange: (dates: string[]) => void
}

/** Format YYYY-MM-DD to JS Date at noon (avoids timezone issues) */
function toDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

/** Format Date to YYYY-MM-DD */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Get ISO weekday: 1=Mon ... 7=Sun */
function isoWeekday(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

/** Get all working dates between start and end (inclusive) */
function getWorkingDatesInRange(startStr: string, endStr: string, workingDays: number[]): string[] {
  const start = toDate(startStr)
  const end = toDate(endStr)
  if (start > end) return getWorkingDatesInRange(endStr, startStr, workingDays)

  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    if (workingDays.includes(isoWeekday(cursor))) {
      dates.push(toStr(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Build a calendar grid for a given month */
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const startWeekday = isoWeekday(firstDay) // 1=Mon ... 7=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []

  // Pad start with nulls
  for (let i = 1; i < startWeekday; i++) {
    cells.push(null)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d, 12, 0, 0))
  }

  // Pad end to complete the last week
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  // Split into weeks
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

const WEEKDAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function DateRangePicker({ selectedDates, workingDays, onDatesChange }: DateRangePickerProps) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [rangeStart, setRangeStart] = useState<string | null>(
    selectedDates.length > 0 ? selectedDates[0] : null
  )
  const [rangeEnd, setRangeEnd] = useState<string | null>(
    selectedDates.length > 1 ? selectedDates[selectedDates.length - 1] : null
  )
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  // Determine the visual range for highlighting (including hover preview)
  const visualStart = rangeStart
  const visualEnd = rangeEnd || hoverDate

  function isInVisualRange(dateStr: string): boolean {
    if (!visualStart || !visualEnd) return false
    const d = dateStr
    const s = visualStart <= visualEnd ? visualStart : visualEnd
    const e = visualStart <= visualEnd ? visualEnd : visualStart
    return d >= s && d <= e
  }

  function handleClickDate(dateStr: string) {
    if (!rangeStart || rangeEnd) {
      // Start new selection
      setRangeStart(dateStr)
      setRangeEnd(null)
      // Single date selection — compute working dates
      const dates = getWorkingDatesInRange(dateStr, dateStr, workingDays)
      onDatesChange(dates)
    } else {
      // Complete the range
      setRangeEnd(dateStr)
      const dates = getWorkingDatesInRange(rangeStart, dateStr, workingDays)
      onDatesChange(dates)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const todayStr = toStr(today)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 w-fit">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAY_HEADERS.map((h, i) => (
          <div
            key={h}
            className={`text-center text-[10px] font-medium py-1 ${
              workingDays.includes(i + 1) ? 'text-slate-500' : 'text-slate-300'
            }`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {grid.flat().map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-8 w-8" />
          }

          const dateStr = toStr(cell)
          const wd = isoWeekday(cell)
          const isWorking = workingDays.includes(wd)
          const isSelected = selectedSet.has(dateStr)
          const isRangeStartDate = dateStr === rangeStart
          const isRangeEndDate = dateStr === rangeEnd
          const inRange = isInVisualRange(dateStr)
          const isToday = dateStr === todayStr

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isWorking}
              onClick={() => handleClickDate(dateStr)}
              onMouseEnter={() => {
                if (rangeStart && !rangeEnd) setHoverDate(dateStr)
              }}
              onMouseLeave={() => setHoverDate(null)}
              className={`h-8 w-8 text-xs rounded-md transition-colors relative ${
                !isWorking
                  ? 'text-slate-200 cursor-not-allowed'
                  : isRangeStartDate || isRangeEndDate
                    ? 'bg-indigo-600 text-white font-bold'
                    : isSelected && inRange
                      ? 'bg-indigo-100 text-indigo-800 font-medium'
                      : inRange
                        ? 'bg-indigo-50 text-indigo-600'
                        : isToday
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cell.getDate()}
            </button>
          )
        })}
      </div>

      {/* Selection summary */}
      {selectedDates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {selectedDates.length === 1
                ? formatDateShort(selectedDates[0])
                : `${formatDateShort(selectedDates[0])} — ${formatDateShort(selectedDates[selectedDates.length - 1])}`}
            </span>
            <span className="text-xs font-medium text-indigo-600">
              {selectedDates.length} working day{selectedDates.length !== 1 ? 's' : ''}
            </span>
          </div>
          {selectedDates.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setRangeStart(null)
                setRangeEnd(null)
                onDatesChange([])
              }}
              className="mt-1 text-[10px] text-slate-400 hover:text-slate-600"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function formatDateShort(dateStr: string): string {
  const d = toDate(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Utility for consumers: get working dates from a single date (returns [date] if it's a working day) */
export function getWorkingDates(dates: string[]): string[] {
  return dates
}
