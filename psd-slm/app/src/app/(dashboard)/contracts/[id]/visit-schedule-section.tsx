'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { addVisitSlot, updateVisitSlot, deleteVisitSlot, checkEngineerConflict } from '../actions'
import type { ContractVisitSlotWithDetails, FieldEngineer } from '@/lib/contracts/types'

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
}

// ProFlex quick-fill mappings
const PROFLEX_WEEKS: Record<string, number[]> = {
  proflex_1: [1],
  proflex_2: [1, 3],
  proflex_3: [1, 2, 3, 4],
}

function formatTime(t: string): string {
  // Time comes as HH:MM:SS or HH:MM — show HH:MM
  return t.slice(0, 5)
}

interface VisitScheduleSectionProps {
  contractId: string
  slots: ContractVisitSlotWithDetails[]
  engineers: FieldEngineer[]
  contractTypeCode: string
  visitFrequency: string | null
  editable: boolean
}

export function VisitScheduleSection({
  contractId,
  slots,
  engineers,
  contractTypeCode,
  visitFrequency,
  editable,
}: VisitScheduleSectionProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ContractVisitSlotWithDetails | null>(null)

  // Calculate visit summary
  const visitsPerCycle = slots.reduce((sum, s) => sum + (s.cycle_week_numbers?.length || 0), 0)
  const visitsPerYear = Math.round(visitsPerCycle * (36 / 4)) // 36-week academic calendar, 4-week cycles

  const columns: Column<ContractVisitSlotWithDetails>[] = [
    {
      key: 'engineer',
      label: 'Engineer',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar
            user={{
              first_name: r.engineer_name.split(' ')[0] || '',
              last_name: r.engineer_name.split(' ')[1] || '',
              initials: r.engineer_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
              color: '#6366f1',
            }}
            size={24}
          />
          <span className="text-sm">{r.engineer_name}</span>
        </div>
      ),
    },
    {
      key: 'day_of_week',
      label: 'Day',
      nowrap: true,
      render: (r) => DAY_LABELS[r.day_of_week] || r.day_of_week,
    },
    {
      key: 'cycle_weeks',
      label: 'Cycle Weeks',
      nowrap: true,
      render: (r) => (
        <span className="text-sm">
          {(r.cycle_week_numbers || []).map((w) => `Wk ${w}`).join(', ')}
        </span>
      ),
    },
    {
      key: 'time_slot',
      label: 'Time Slot',
      nowrap: true,
      render: (r) => {
        const cfg = TIME_SLOT_CONFIG[r.time_slot]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.time_slot
      },
    },
    {
      key: 'effective_time',
      label: 'Effective Time',
      nowrap: true,
      render: (r) => `${formatTime(r.effective_start_time)} \u2013 ${formatTime(r.effective_end_time)}`,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (r) => r.notes || '\u2014',
    },
    ...(editable
      ? [
          {
            key: 'actions',
            label: '',
            nowrap: true,
            align: 'right' as const,
            render: (r: ContractVisitSlotWithDetails) => (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingSlot(r) }}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Edit
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (confirm('Delete this visit slot?')) {
                      await deleteVisitSlot(r.id, contractId)
                      router.refresh()
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            ),
          } as Column<ContractVisitSlotWithDetails>,
        ]
      : []),
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Visit Schedule ({slots.length})</h3>
        {editable && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            + Add Visit Slot
          </button>
        )}
      </div>

      <DataTable columns={columns} data={slots} emptyMessage="No visit slots configured." />

      {slots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500">
          This contract generates <span className="font-semibold text-slate-700">{visitsPerCycle}</span> visit{visitsPerCycle !== 1 ? 's' : ''} per 4-week cycle
          (<span className="font-semibold text-slate-700">{visitsPerYear}</span> per year based on 36-week calendar)
        </div>
      )}

      {(showAdd || editingSlot) && (
        <VisitSlotModal
          contractId={contractId}
          slot={editingSlot}
          engineers={engineers}
          contractTypeCode={contractTypeCode}
          visitFrequency={visitFrequency}
          onClose={() => { setShowAdd(false); setEditingSlot(null) }}
          onSaved={() => { setShowAdd(false); setEditingSlot(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function VisitSlotModal({
  contractId,
  slot,
  engineers,
  contractTypeCode,
  visitFrequency,
  onClose,
  onSaved,
}: {
  contractId: string
  slot: ContractVisitSlotWithDetails | null
  engineers: FieldEngineer[]
  contractTypeCode: string
  visitFrequency: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflictWarning, setConflictWarning] = useState('')

  const [form, setForm] = useState({
    engineer_id: slot?.engineer_id || '',
    day_of_week: slot?.day_of_week || 'monday',
    time_slot: slot?.time_slot || 'am',
    cycle_weeks: slot?.cycle_week_numbers || ([] as number[]),
    override_start_time: slot?.override_start_time || '',
    override_end_time: slot?.override_end_time || '',
    notes: slot?.notes || '',
  })

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleWeek = (week: number) => {
    setForm((f) => ({
      ...f,
      cycle_weeks: f.cycle_weeks.includes(week)
        ? f.cycle_weeks.filter((w) => w !== week)
        : [...f.cycle_weeks, week].sort(),
    }))
  }

  const quickFill = (code: string) => {
    const weeks = PROFLEX_WEEKS[code]
    if (weeks) {
      setForm((f) => ({ ...f, cycle_weeks: weeks }))
    }
  }

  const isWeekdays = form.day_of_week === 'weekdays'

  const handleSave = async () => {
    if (!form.engineer_id) { setError('Engineer is required'); return }
    if (form.cycle_weeks.length === 0) { setError('At least one cycle week must be selected'); return }

    setSaving(true)
    setError('')
    setConflictWarning('')

    // Check for conflicts — for weekdays, check all 5 days
    const daysToCheck = isWeekdays ? [...DAYS_OF_WEEK] : [form.day_of_week]
    const conflictMessages: string[] = []

    for (const day of daysToCheck) {
      const conflict = await checkEngineerConflict(
        form.engineer_id,
        day,
        form.cycle_weeks,
        slot?.id
      )
      if (conflict.hasConflict) {
        conflictMessages.push(`${DAY_LABELS[day]}: ${conflict.conflictDetails}`)
      }
    }

    if (conflictMessages.length > 0) {
      setConflictWarning(conflictMessages.join('\n'))
      setSaving(false)
      return
    }

    await doSave()
  }

  const buildFormData = (dayOfWeek: string): FormData => {
    const fd = new FormData()
    fd.append('engineer_id', form.engineer_id)
    fd.append('day_of_week', dayOfWeek)
    fd.append('time_slot', form.time_slot)
    fd.append('cycle_week_numbers', JSON.stringify(form.cycle_weeks))
    fd.append('notes', form.notes)
    if (form.time_slot === 'custom') {
      fd.append('override_start_time', form.override_start_time)
      fd.append('override_end_time', form.override_end_time)
    }
    return fd
  }

  const doSave = async () => {
    setSaving(true)

    if (slot) {
      // Editing — always single slot
      const result = await updateVisitSlot(slot.id, contractId, buildFormData(form.day_of_week))
      setSaving(false)
      if (result.error) { setError(result.error) } else { onSaved() }
      return
    }

    // Creating — single day or weekdays (5 slots)
    const days = isWeekdays ? [...DAYS_OF_WEEK] : [form.day_of_week]
    const errors: string[] = []

    for (const day of days) {
      const result = await addVisitSlot(contractId, buildFormData(day))
      if (result.error) errors.push(`${DAY_LABELS[day] || day}: ${result.error}`)
    }

    setSaving(false)
    if (errors.length > 0) {
      setError(errors.join('; '))
    } else {
      onSaved()
    }
  }

  // Determine effective time display
  let effectiveStart = '08:30'
  let effectiveEnd = '12:00'
  if (form.time_slot === 'pm') { effectiveStart = '12:30'; effectiveEnd = '16:00' }
  if (form.time_slot === 'custom') {
    effectiveStart = form.override_start_time || '08:30'
    effectiveEnd = form.override_end_time || '12:00'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {slot ? 'Edit Visit Slot' : 'Add Visit Slot'}
        </h3>

        {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
        {conflictWarning && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <p className="font-medium mb-1">Schedule Conflict{isWeekdays ? '(s)' : ''} Detected</p>
            <p className="whitespace-pre-line">{conflictWarning}</p>
            <button
              onClick={doSave}
              disabled={saving}
              className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Anyway'}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Engineer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Engineer *</label>
            <select
              value={form.engineer_id}
              onChange={upd('engineer_id')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Select engineer...</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.first_name} {eng.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day + Time Slot */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Day of Week *</label>
              <select
                value={form.day_of_week}
                onChange={upd('day_of_week')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {visitFrequency === 'daily' && !slot && (
                  <option value="weekdays">Weekdays (Mon–Fri)</option>
                )}
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>{DAY_LABELS[d]}</option>
                ))}
              </select>
              {form.day_of_week === 'weekdays' && (
                <p className="text-xs text-indigo-600 mt-1">Creates 5 slots — one for each weekday</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time Slot *</label>
              <select
                value={form.time_slot}
                onChange={upd('time_slot')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="am">AM (08:30 - 12:00)</option>
                <option value="pm">PM (12:30 - 16:00)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Custom times */}
          {form.time_slot === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-indigo-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.override_start_time}
                  onChange={upd('override_start_time')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={form.override_end_time}
                  onChange={upd('override_end_time')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Effective time display */}
          <div className="text-xs text-slate-500">
            Effective time: <span className="font-medium text-slate-700">{effectiveStart} \u2013 {effectiveEnd}</span>
          </div>

          {/* Cycle Weeks */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cycle Weeks *</label>
            <div className="flex gap-3 mb-2">
              {[1, 2, 3, 4].map((week) => (
                <label key={week} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cycle_weeks.includes(week)}
                    onChange={() => toggleWeek(week)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Week {week}</span>
                </label>
              ))}
            </div>
            {/* Quick-fill buttons */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-slate-400 self-center">Quick-fill:</span>
              <button
                type="button"
                onClick={() => quickFill('proflex_1')}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                ProFlex 1 (Wk 1)
              </button>
              <button
                type="button"
                onClick={() => quickFill('proflex_2')}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                ProFlex 2 (Wk 1, 3)
              </button>
              <button
                type="button"
                onClick={() => quickFill('proflex_3')}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                ProFlex 3 (All)
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={upd('notes')}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isWeekdays ? 'Create 5 Slots' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
