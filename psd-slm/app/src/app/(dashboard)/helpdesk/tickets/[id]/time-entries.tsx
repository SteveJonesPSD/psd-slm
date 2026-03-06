'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { logTime } from '../../actions'

interface TimeEntry {
  id: string
  minutes: number
  description: string | null
  is_billable: boolean
  entry_date: string
  created_at: string
  user?: { id: string; first_name: string; last_name: string; initials: string | null } | null
}

export function TimeEntries({ ticketId, entries }: { ticketId: string; entries: Record<string, unknown>[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ hours: '0', minutes: '15', description: '', is_billable: true })

  const timeEntries = entries as unknown as TimeEntry[]
  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.minutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMins = totalMinutes % 60

  async function handleLog() {
    const mins = (parseInt(form.hours) || 0) * 60 + (parseInt(form.minutes) || 0)
    if (mins <= 0) return
    setSaving(true)
    try {
      await logTime(ticketId, {
        minutes: mins,
        description: form.description || undefined,
        is_billable: form.is_billable,
      })
      setForm({ hours: '0', minutes: '15', description: '', is_billable: true })
      setShowForm(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Time Logged
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {totalHours}h {totalMins}m
          </span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            + Log
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-2">
          <div className="flex gap-2">
            <div>
              <label className="text-[10px] text-slate-400">Hours</label>
              <input
                type="number"
                value={form.hours}
                onChange={e => setForm({ ...form, hours: e.target.value })}
                min={0}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Minutes</label>
              <input
                type="number"
                value={form.minutes}
                onChange={e => setForm({ ...form, minutes: e.target.value })}
                min={0}
                max={59}
                step={5}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.is_billable}
                onChange={e => setForm({ ...form, is_billable: e.target.checked })}
                className="rounded border-gray-300"
              />
              Billable
            </label>
            <Button
              variant="primary"
              size="sm"
              onClick={handleLog}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Log Time'}
            </Button>
          </div>
        </div>
      )}

      {timeEntries.length > 0 ? (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {timeEntries.map(entry => (
            <div key={entry.id} className="flex items-start justify-between text-xs">
              <div>
                <span className="font-medium text-slate-700">
                  {Math.floor(entry.minutes / 60) > 0 && `${Math.floor(entry.minutes / 60)}h `}
                  {entry.minutes % 60}m
                </span>
                {!entry.is_billable && <span className="ml-1 text-slate-300">(non-billable)</span>}
                {entry.description && (
                  <div className="text-slate-400 truncate max-w-[200px]">{entry.description}</div>
                )}
              </div>
              <div className="text-right text-slate-400">
                <div>{entry.user ? `${entry.user.first_name} ${entry.user.last_name[0]}.` : ''}</div>
                <div>{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-300">No time logged yet</p>
      )}
    </div>
  )
}
