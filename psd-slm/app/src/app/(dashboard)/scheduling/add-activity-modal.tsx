'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { createActivity, type CreateActivityInput } from './actions'
import { DateRangePicker } from './date-range-picker'

interface ActivityType {
  id: string
  name: string
  slug: string
  color: string
  background: string
  default_duration_minutes: number
}

interface Engineer {
  id: string
  first_name: string
  last_name: string
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: 'Half day (4h)', value: 240 },
  { label: 'Full day (8h)', value: 480 },
]

interface AddActivityModalProps {
  activityTypes: ActivityType[]
  engineers: Engineer[]
  workingDays?: number[]
  prefillDate?: string
  prefillEngineerId?: string
  prefillTime?: string
  onClose: () => void
}

export function AddActivityModal({ activityTypes, engineers, workingDays = [1, 2, 3, 4, 5], prefillDate, prefillEngineerId, prefillTime, onClose }: AddActivityModalProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    activity_type_id: '',
    engineer_id: prefillEngineerId || '',
    title: '',
    scheduled_date: prefillDate || today,
    scheduled_time: prefillTime || '',
    duration_minutes: 60,
    all_day: false,
    notes: '',
  })

  // Date selection via range picker
  const [selectedDates, setSelectedDates] = useState<string[]>(form.scheduled_date ? [form.scheduled_date] : [])

  // Auto-populate title and duration when activity type changes
  useEffect(() => {
    const at = activityTypes.find(t => t.id === form.activity_type_id)
    if (at) {
      setForm(f => ({
        ...f,
        title: f.title || at.name,
        duration_minutes: at.default_duration_minutes,
      }))
    }
  }, [form.activity_type_id, activityTypes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.activity_type_id || !form.engineer_id || !form.scheduled_date) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError('')

    const dates = selectedDates.length > 0 ? selectedDates : [form.scheduled_date]
    const title = form.title || activityTypes.find(t => t.id === form.activity_type_id)?.name || 'Activity'

    let created = 0
    const errors: string[] = []

    for (const date of dates) {
      const input: CreateActivityInput = {
        activity_type_id: form.activity_type_id,
        engineer_id: form.engineer_id,
        title,
        scheduled_date: date,
        scheduled_time: form.all_day ? undefined : (form.scheduled_time || undefined),
        duration_minutes: form.duration_minutes,
        all_day: form.all_day,
        notes: form.notes || undefined,
      }

      const result = await createActivity(input)
      if (result.error) {
        errors.push(result.error)
      } else {
        created++
      }
    }

    setSaving(false)

    if (errors.length > 0 && created === 0) {
      setError(errors[0])
    } else {
      router.refresh()
      onClose()
    }
  }

  const totalActivities = selectedDates.length > 1 ? selectedDates.length : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Activity</h3>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {activityTypes.length === 0 && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No activity types configured. Go to Scheduling Configuration to add some.
            </div>
          )}

          <div className="space-y-4">
            <SearchableSelect
              label="Activity Type"
              required
              value={form.activity_type_id}
              options={activityTypes.map(t => ({ value: t.id, label: t.name }))}
              placeholder="Select type..."
              onChange={(val) => setForm(f => ({ ...f, activity_type_id: val }))}
            />

            <SearchableSelect
              label="Engineer"
              required
              value={form.engineer_id}
              options={engineers.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
              placeholder="Select engineer..."
              onChange={(val) => setForm(f => ({ ...f, engineer_id: val }))}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Annual Leave"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
              <select
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <DateRangePicker
                selectedDates={selectedDates}
                workingDays={workingDays}
                onDatesChange={(dates) => {
                  setSelectedDates(dates)
                  setForm(f => ({ ...f, scheduled_date: dates[0] || '' }))
                }}
              />
            </div>

            {selectedDates.length > 1 && (
              <p className="text-xs text-amber-600">
                {selectedDates.length} days selected — {selectedDates.length} activities will be created
              </p>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="all_day"
                  checked={form.all_day}
                  onChange={e => setForm(f => ({ ...f, all_day: e.target.checked, scheduled_time: '' }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="all_day" className="text-sm text-slate-700">All day</label>
              </div>
              {!form.all_day && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.scheduled_time}
                    onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || activityTypes.length === 0}
            >
              {saving ? 'Saving...' : totalActivities > 1 ? `Add ${totalActivities} Activities` : 'Add Activity'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
