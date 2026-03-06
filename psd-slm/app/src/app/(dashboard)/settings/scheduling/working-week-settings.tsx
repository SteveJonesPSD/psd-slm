'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveSettings } from '../actions'

const ALL_DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

export function WorkingWeekSettings({ initialWorkingDays }: { initialWorkingDays: number[] }) {
  const router = useRouter()
  const [workingDays, setWorkingDays] = useState<number[]>(initialWorkingDays)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleDay(day: number) {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveSettings([
      {
        category: 'scheduling',
        setting_key: 'scheduling_working_days',
        setting_value: JSON.stringify(workingDays),
        description: 'Days of the week when jobs/activities can be booked (1=Mon, 7=Sun)',
      },
    ])
    setSaving(false)

    if (result.success) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">Working Week</h3>
      <p className="text-xs text-slate-500 mb-4">
        Select which days jobs and activities can be booked. Multi-day bookings will only create entries on these days.
      </p>

      <div className="space-y-2">
        {ALL_DAYS.map(day => (
          <label
            key={day.value}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              workingDays.includes(day.value)
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={workingDays.includes(day.value)}
              onChange={() => toggleDay(day.value)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className={`text-sm font-medium ${workingDays.includes(day.value) ? 'text-indigo-700' : 'text-slate-600'}`}>
              {day.label}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  )
}
