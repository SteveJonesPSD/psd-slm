'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { updateActivity, deleteActivity, type UpdateActivityInput } from './actions'

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

interface EditActivityModalProps {
  activity: {
    id: string
    activity_type_id: string
    engineer_id: string
    title: string
    scheduled_date: string
    scheduled_time: string | null
    duration_minutes: number
    all_day: boolean
    notes: string | null
  }
  activityTypes: ActivityType[]
  engineers: Engineer[]
  onClose: () => void
}

export function EditActivityModal({ activity, activityTypes, engineers, onClose }: EditActivityModalProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    activity_type_id: activity.activity_type_id,
    engineer_id: activity.engineer_id,
    title: activity.title,
    scheduled_date: activity.scheduled_date,
    scheduled_time: activity.scheduled_time || '',
    duration_minutes: activity.duration_minutes,
    all_day: activity.all_day,
    notes: activity.notes || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.activity_type_id || !form.engineer_id || !form.scheduled_date) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError('')

    const input: UpdateActivityInput = {
      activity_type_id: form.activity_type_id,
      engineer_id: form.engineer_id,
      title: form.title || activityTypes.find(t => t.id === form.activity_type_id)?.name || 'Activity',
      scheduled_date: form.scheduled_date,
      scheduled_time: form.all_day ? null : (form.scheduled_time || null),
      duration_minutes: form.duration_minutes,
      all_day: form.all_day,
      notes: form.notes || null,
    }

    const result = await updateActivity(activity.id, input)
    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    setError('')

    const result = await deleteActivity(activity.id)
    setDeleting(false)

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Activity</h3>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration</label>
              <select
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_all_day"
                  checked={form.all_day}
                  onChange={e => setForm(f => ({ ...f, all_day: e.target.checked, scheduled_time: '' }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="edit_all_day" className="text-sm text-slate-700 dark:text-slate-300">All day</label>
              </div>
              {!form.all_day && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.scheduled_time}
                    onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 dark:text-red-400">Are you sure?</span>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
