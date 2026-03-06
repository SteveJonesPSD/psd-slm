'use client'

import { useMemo } from 'react'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

/** Given a YYYY-MM-DD string, return its weekday index (0=Mon, 4=Fri, -1 if weekend) */
function getWeekdayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const jsDay = d.getDay() // 0=Sun, 1=Mon ... 6=Sat
  if (jsDay === 0 || jsDay === 6) return -1
  return jsDay - 1 // 0=Mon ... 4=Fri
}

/** Format date for display: "Mon 5 Mar" */
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Compute remaining working days from a start date through Friday of that week */
function getRemainingWeekdays(startDate: string): { date: string; label: string; dayLabel: string }[] {
  const idx = getWeekdayIndex(startDate)
  if (idx < 0) return [] // weekend — no weekdays

  const days: { date: string; label: string; dayLabel: string }[] = []
  const base = new Date(startDate + 'T12:00:00')

  for (let i = idx; i < 5; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + (i - idx))
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    days.push({
      date: dateStr,
      label: formatDayLabel(dateStr),
      dayLabel: DAY_LABELS[i],
    })
  }

  return days
}

interface MultiDayPickerProps {
  startDate: string
  isMultiDay: boolean
  selectedDates: string[]
  onToggleMultiDay: (checked: boolean) => void
  onToggleDate: (date: string) => void
}

export function MultiDayPicker({ startDate, isMultiDay, selectedDates, onToggleMultiDay, onToggleDate }: MultiDayPickerProps) {
  const weekdays = useMemo(() => getRemainingWeekdays(startDate), [startDate])

  // Don't show if start date is a Friday (only 1 day) or weekend
  if (!startDate || weekdays.length <= 1) return null

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="multi_day"
          checked={isMultiDay}
          onChange={e => onToggleMultiDay(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="multi_day" className="text-sm font-medium text-slate-700">Multi-day</label>
      </div>

      {isMultiDay && (
        <div className="mt-2 flex flex-wrap gap-2">
          {weekdays.map((day, i) => {
            const isStart = i === 0
            const isSelected = selectedDates.includes(day.date)
            return (
              <label
                key={day.date}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                } ${isStart ? 'opacity-75 cursor-default' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isStart}
                  onChange={() => onToggleDate(day.date)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>{day.dayLabel}</span>
                <span className="text-[10px] opacity-70">{day.label.split(' ').slice(1).join(' ')}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Utility: compute all selected dates for multi-day from the start date */
export function getMultiDayDates(startDate: string): string[] {
  return getRemainingWeekdays(startDate).map(d => d.date)
}
