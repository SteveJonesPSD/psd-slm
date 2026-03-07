'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getSchedulingSettings, updateSchedulingSettings } from '../../actions'

export function WorkingHoursForm() {
  const [dayStart, setDayStart] = useState('08:00')
  const [dayEnd, setDayEnd] = useState('17:30')
  const [travelBuffer, setTravelBuffer] = useState(15)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getSchedulingSettings().then(settings => {
      if (settings.working_day_start) setDayStart(settings.working_day_start)
      if (settings.working_day_end) setDayEnd(settings.working_day_end)
      if (settings.travel_buffer_minutes !== undefined) setTravelBuffer(settings.travel_buffer_minutes)
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setToast('')

    try {
      const result = await updateSchedulingSettings({
        working_day_start: dayStart,
        working_day_end: dayEnd,
        travel_buffer_minutes: travelBuffer,
      })

      if (result.error) {
        setToast(`Error: ${result.error}`)
      } else {
        setToast('Settings saved successfully')
        setTimeout(() => setToast(''), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-6">
      {toast && (
        <div className={`rounded-lg p-3 text-sm ${toast.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {toast}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Working Hours</h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Define the standard working day. Smart Schedule uses these boundaries to determine if a suggested time is within or outside working hours.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Day Start</label>
            <input
              type="time"
              value={dayStart}
              onChange={e => setDayStart(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Day End</label>
            <input
              type="time"
              value={dayEnd}
              onChange={e => setDayEnd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Travel Buffer</h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Extra buffer added to travel time estimates between jobs. Accounts for parking, walking to site, etc.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Buffer (minutes)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={travelBuffer}
            onChange={e => setTravelBuffer(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}
