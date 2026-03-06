'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCalendar } from '../../actions'
import { Button } from '@/components/ui/button'

export function NewCalendarForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Default to current academic year (Sep–Jul)
  const now = new Date()
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const endYear = startYear + 1

  const [name, setName] = useState(`SchoolCare ${startYear}/${endYear}`)
  const [academicYearStart, setAcademicYearStart] = useState(`${startYear}-09-01`)
  const [academicYearEnd, setAcademicYearEnd] = useState(`${endYear}-07-31`)
  const [scheduleWeeks, setScheduleWeeks] = useState(39)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('name', name)
    fd.set('academic_year_start', academicYearStart)
    fd.set('academic_year_end', academicYearEnd)
    fd.set('schedule_weeks', String(scheduleWeeks))

    startTransition(async () => {
      const res = await createCalendar(fd)
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        router.push(`/visit-scheduling/calendars/${res.data.id}`)
      }
    })
  }

  // Derive display label from dates
  const startLabel = academicYearStart ? new Date(academicYearStart + 'T00:00:00').getFullYear() : ''
  const endLabel = academicYearEnd ? new Date(academicYearEnd + 'T00:00:00').getFullYear() : ''
  const academicYearDisplay = startLabel && endLabel ? `${startLabel}/${endLabel}` : ''

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Calendar Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. SchoolCare 2025/2026"
            />
          </div>

          {academicYearDisplay && (
            <div className="text-xs text-slate-500">
              Academic Year: <span className="font-medium text-slate-700">{academicYearDisplay}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year Start *</label>
              <input
                type="date"
                value={academicYearStart}
                onChange={(e) => setAcademicYearStart(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year End *</label>
              <input
                type="date"
                value={academicYearEnd}
                onChange={(e) => setAcademicYearEnd(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Weeks</label>
            <select
              value={scheduleWeeks}
              onChange={(e) => setScheduleWeeks(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value={36}>36 weeks</option>
              <option value={39}>39 weeks</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4 gap-2">
          <button
            type="button"
            onClick={() => router.push('/visit-scheduling/calendars')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create Calendar'}
          </Button>
        </div>
      </div>
    </form>
  )
}
