'use client'

import { useState, useTransition } from 'react'
import { Badge, CALENDAR_STATUS_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateVisits } from '../actions'
import type { VisitCalendar, GenerationResult } from '@/lib/visit-scheduling/types'
import { SearchableSelect } from '@/components/ui/form-fields'

interface GenerateFormProps {
  calendars: VisitCalendar[]
  engineers: { id: string; first_name: string; last_name: string }[]
}

export function GenerateForm({ calendars, engineers }: GenerateFormProps) {
  const [isPending, startTransition] = useTransition()
  const [calendarId, setCalendarId] = useState(calendars.find(c => c.status === 'active')?.id || calendars[0]?.id || '')
  const [engineerId, setEngineerId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedCalendar = calendars.find(c => c.id === calendarId)

  // Build month options from the selected calendar's date range
  const monthOptions: { value: string; label: string }[] = []
  if (selectedCalendar) {
    const start = new Date(selectedCalendar.academic_year_start + 'T00:00:00')
    const end = new Date(selectedCalendar.academic_year_end + 'T00:00:00')
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const m = cur.getMonth() + 1
      const y = cur.getFullYear()
      const label = cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      monthOptions.push({ value: `${y}-${m}`, label })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  async function handleGenerate() {
    if (!calendarId) {
      setError('Please select a calendar')
      return
    }

    setError(null)
    setResult(null)

    const monthParts = selectedMonth ? selectedMonth.split('-') : null
    const month = monthParts ? Number(monthParts[1]) : null
    const year = monthParts ? Number(monthParts[0]) : null

    startTransition(async () => {
      const res = await generateVisits({
        calendar_id: calendarId,
        engineer_id: engineerId || null,
        month,
        year,
      })

      if (res.errors.length > 0 && res.created === 0) {
        setError(res.errors.join('; '))
      }
      setResult(res)
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-slate-900">Generation Settings</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visits are created from contract visit slots. Existing visits are skipped (no duplicates).
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Calendar */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Calendar *</label>
            <SearchableSelect
              value={calendarId}
              options={calendars.map(c => {
                const cfg = CALENDAR_STATUS_CONFIG[c.status]
                return { value: c.id, label: `${c.name} (${c.academic_year_start?.slice(0, 4)}/${c.academic_year_end?.slice(2, 4)}) — ${cfg?.label || c.status}` }
              })}
              placeholder="Search calendars..."
              onChange={setCalendarId}
            />
            {selectedCalendar && (
              <div className="mt-1 text-xs text-slate-500">
                {selectedCalendar.academic_year_start} to {selectedCalendar.academic_year_end} · {selectedCalendar.schedule_weeks}-week cycle
              </div>
            )}
          </div>

          {/* Engineer (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Engineer</label>
            <SearchableSelect
              value={engineerId}
              options={engineers.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
              placeholder="All engineers"
              onChange={setEngineerId}
            />
            <div className="mt-1 text-xs text-slate-400">Leave blank to generate for all engineers</div>
          </div>

          {/* Month (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="">All months (full calendar)</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <div className="mt-1 text-xs text-slate-400">Optionally limit generation to a single month</div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="text-xs text-slate-400">
            {isPending ? 'Generating visits...' : 'Ready to generate'}
          </div>
          <Button
            onClick={handleGenerate}
            variant="primary"
            disabled={isPending || !calendarId}
          >
            {isPending ? 'Generating...' : 'Generate Visits'}
          </Button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-slate-900">Generation Results</h3>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.created}</div>
                <div className="text-xs text-slate-500">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">{result.skipped}</div>
                <div className="text-xs text-slate-500">Skipped (existing)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{result.bank_holiday_flagged}</div>
                <div className="text-xs text-slate-500">Bank Holiday</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                <div className="font-medium mb-1">Errors:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.created > 0 && result.errors.length === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                {result.created} visits generated successfully.
                {result.bank_holiday_flagged > 0 && ` ${result.bank_holiday_flagged} fall on bank holidays — review in the week view.`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
