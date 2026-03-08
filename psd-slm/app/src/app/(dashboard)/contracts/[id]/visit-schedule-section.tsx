'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { addVisitSlot, updateVisitSlot, deleteVisitSlot, checkEngineerConflict } from '../actions'
import type { ContractVisitSlotWithDetails, FieldEngineer } from '@/lib/contracts/types'
import { PROFLEX_CYCLE_DEFAULTS } from '@/lib/visit-scheduling/types'

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

// Derive the max selectable cycle weeks from contract type code or visit frequency
function getMaxCycleWeeks(contractTypeCode: string, visitFrequency: string | null): number {
  // ProFlex codes have explicit mappings
  const proflexWeeks = PROFLEX_CYCLE_DEFAULTS[contractTypeCode]
  if (proflexWeeks) return proflexWeeks.length

  // Fall back to frequency
  switch (visitFrequency) {
    case 'monthly': return 1
    case 'fortnightly': return 2
    case 'weekly': return 4
    case 'daily': return 4
    default: return 4
  }
}

// Get the ProFlex quick-fill options relevant to this contract type
function getQuickFillOptions(contractTypeCode: string): { code: string; label: string; weeks: number[] }[] {
  const options: { code: string; label: string; weeks: number[] }[] = []
  const entries: [string, string, number[]][] = [
    ['proflex_1', 'ProFlex 1 (Wk 1)', [1]],
    ['proflex_2', 'ProFlex 2 (Wk 1, 3)', [1, 3]],
    ['proflex_3', 'ProFlex 3 (Wk 1–3)', [1, 2, 3]],
    ['proflex_4', 'ProFlex 4 (All)', [1, 2, 3, 4]],
  ]
  for (const [code, label, weeks] of entries) {
    // Only show quick-fills that match or are below the contract type level
    const maxWeeks = PROFLEX_CYCLE_DEFAULTS[contractTypeCode]?.length ?? 4
    if (weeks.length <= maxWeeks) {
      options.push({ code, label, weeks })
    }
  }
  // If not a proflex type, show all
  if (!contractTypeCode.startsWith('proflex_')) {
    return entries.map(([code, label, weeks]) => ({ code, label, weeks }))
  }
  return options
}

interface VisitScheduleSectionProps {
  contractId: string
  slots: ContractVisitSlotWithDetails[]
  engineers: FieldEngineer[]
  contractTypeCode: string
  visitFrequency: string | null
  scheduleWeeks: number | null
  editable: boolean
}

export function VisitScheduleSection({
  contractId,
  slots,
  engineers,
  contractTypeCode,
  visitFrequency,
  scheduleWeeks,
  editable,
}: VisitScheduleSectionProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ContractVisitSlotWithDetails | null>(null)

  // Calculate visit summary using calendar's schedule_weeks (default 36)
  const weeksInYear = scheduleWeeks || 36
  const visitsPerCycle = slots.reduce((sum, s) => sum + (s.cycle_week_numbers?.length || 0), 0)
  const visitsPerYear = Math.round(visitsPerCycle * (weeksInYear / 4))

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
      render: (r) => `${formatTime(r.effective_start_time)} – ${formatTime(r.effective_end_time)}`,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (r) => r.notes || '—',
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold dark:text-white">Visit Schedule ({slots.length})</h3>
        {editable && (
          <Button
            onClick={() => setShowAdd(true)}
            variant="primary"
            size="sm"
          >
            + Add Visit Slot
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={slots} emptyMessage="No visit slots configured." />

      {slots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          This contract generates <span className="font-semibold text-slate-700 dark:text-slate-200">{visitsPerCycle}</span> visit{visitsPerCycle !== 1 ? 's' : ''} per 4-week cycle
          (<span className="font-semibold text-slate-700 dark:text-slate-200">{visitsPerYear}</span> per year based on 36-week calendar)
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

// ============================================================
// Interfaces for "Different Days" grid rows
// ============================================================
interface DifferentDayRow {
  cycle_week: number
  day_of_week: string
  time_slot: string
  override_start_time: string
  override_end_time: string
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

  const maxWeeks = getMaxCycleWeeks(contractTypeCode, visitFrequency)
  const quickFillOptions = getQuickFillOptions(contractTypeCode)

  const [form, setForm] = useState({
    engineer_id: slot?.engineer_id || '',
    day_of_week: slot?.day_of_week || 'monday',
    time_slot: slot?.time_slot || 'am',
    cycle_weeks: slot?.cycle_week_numbers || ([] as number[]),
    override_start_time: slot?.override_start_time || '',
    override_end_time: slot?.override_end_time || '',
    notes: slot?.notes || '',
  })

  const [differentDays, setDifferentDays] = useState(false)
  const [dayRows, setDayRows] = useState<DifferentDayRow[]>(() => {
    // Initialise with the correct number of rows for the max weeks
    return Array.from({ length: maxWeeks }, (_, i) => ({
      cycle_week: i + 1,
      day_of_week: 'monday',
      time_slot: 'am',
      override_start_time: '',
      override_end_time: '',
    }))
  })

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleWeek = (week: number) => {
    setForm((f) => {
      const current = f.cycle_weeks
      if (current.includes(week)) {
        return { ...f, cycle_weeks: current.filter((w) => w !== week) }
      }
      // Don't exceed max
      if (current.length >= maxWeeks) return f
      return { ...f, cycle_weeks: [...current, week].sort() }
    })
  }

  const quickFill = (weeks: number[]) => {
    setForm((f) => ({ ...f, cycle_weeks: weeks }))
  }

  const updateDayRow = (index: number, field: keyof DifferentDayRow, value: string | number) => {
    setDayRows((rows) => rows.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const isWeekdays = form.day_of_week === 'weekdays'

  const handleSave = async () => {
    if (!form.engineer_id) { setError('Engineer is required'); return }

    if (differentDays) {
      // Validate day rows
      for (const row of dayRows) {
        if (row.time_slot === 'custom' && (!row.override_start_time || !row.override_end_time)) {
          setError(`Custom time required for Week ${row.cycle_week}`)
          return
        }
      }
    } else {
      if (form.cycle_weeks.length < maxWeeks) {
        setError(`This contract type requires ${maxWeeks} cycle week${maxWeeks !== 1 ? 's' : ''} — ${maxWeeks - form.cycle_weeks.length} more needed`)
        return
      }
    }

    setSaving(true)
    setError('')
    setConflictWarning('')

    if (differentDays) {
      // Check conflicts for each row
      const conflictMessages: string[] = []
      for (const row of dayRows) {
        const conflict = await checkEngineerConflict(
          form.engineer_id,
          row.day_of_week,
          [row.cycle_week],
          slot?.id
        )
        if (conflict.hasConflict) {
          conflictMessages.push(`Wk ${row.cycle_week} ${DAY_LABELS[row.day_of_week]}: ${conflict.conflictDetails}`)
        }
      }
      if (conflictMessages.length > 0) {
        setConflictWarning(conflictMessages.join('\n'))
        setSaving(false)
        return
      }
      await doSaveDifferentDays()
    } else {
      // Normal mode — check conflicts
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
  }

  const buildFormData = (dayOfWeek: string, cycleWeeks?: number[], timeSlot?: string, overrideStart?: string, overrideEnd?: string): FormData => {
    const fd = new FormData()
    fd.append('engineer_id', form.engineer_id)
    fd.append('day_of_week', dayOfWeek)
    fd.append('time_slot', timeSlot || form.time_slot)
    fd.append('cycle_week_numbers', JSON.stringify(cycleWeeks || form.cycle_weeks))
    fd.append('notes', form.notes)
    const ts = timeSlot || form.time_slot
    if (ts === 'custom') {
      fd.append('override_start_time', overrideStart || form.override_start_time)
      fd.append('override_end_time', overrideEnd || form.override_end_time)
    }
    return fd
  }

  const doSave = async () => {
    setSaving(true)

    if (slot) {
      const result = await updateVisitSlot(slot.id, contractId, buildFormData(form.day_of_week))
      setSaving(false)
      if (result.error) { setError(result.error) } else { onSaved() }
      return
    }

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

  const doSaveDifferentDays = async () => {
    setSaving(true)
    const errors: string[] = []

    for (const row of dayRows) {
      const fd = buildFormData(
        row.day_of_week,
        [row.cycle_week],
        row.time_slot,
        row.override_start_time,
        row.override_end_time
      )
      const result = await addVisitSlot(contractId, fd)
      if (result.error) errors.push(`Wk ${row.cycle_week}: ${result.error}`)
    }

    setSaving(false)
    if (errors.length > 0) {
      setError(errors.join('; '))
    } else {
      onSaved()
    }
  }

  // Determine effective time display (normal mode only)
  let effectiveStart = '08:30'
  let effectiveEnd = '12:00'
  if (form.time_slot === 'pm') { effectiveStart = '12:30'; effectiveEnd = '16:00' }
  if (form.time_slot === 'custom') {
    effectiveStart = form.override_start_time || '08:30'
    effectiveEnd = form.override_end_time || '12:00'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 dark:text-white">
          {slot ? 'Edit Visit Slot' : 'Add Visit Slot'}
        </h3>

        {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{error}</div>}
        {conflictWarning && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
            <p className="font-medium mb-1">Schedule Conflict Detected</p>
            <p className="whitespace-pre-line">{conflictWarning}</p>
            <button
              onClick={differentDays ? doSaveDifferentDays : doSave}
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
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Engineer *</label>
            <select
              value={form.engineer_id}
              onChange={upd('engineer_id')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="">Select engineer...</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.first_name} {eng.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Different Days checkbox — only for new slots, not edit */}
          {!slot && maxWeeks > 1 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={differentDays}
                onChange={(e) => setDifferentDays(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Different days per cycle week</span>
            </label>
          )}

          {differentDays && !slot ? (
            /* ============================================================
               DIFFERENT DAYS MODE — Grid of cycle week / day / time
               ============================================================ */
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">Schedule per Cycle Week</label>
              <div className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-600">
                {/* Header */}
                <div className="grid grid-cols-[80px_1fr_1fr] bg-slate-50 border-b border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Week</div>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Day</div>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Time</div>
                </div>
                {/* Rows */}
                {dayRows.map((row, idx) => (
                  <div key={row.cycle_week} className={`grid grid-cols-[80px_1fr_1fr] items-center ${idx < dayRows.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                    <div className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Week {row.cycle_week}
                    </div>
                    <div className="px-2 py-1.5">
                      <select
                        value={row.day_of_week}
                        onChange={(e) => updateDayRow(idx, 'day_of_week', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>{DAY_LABELS[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="px-2 py-1.5">
                      <select
                        value={row.time_slot}
                        onChange={(e) => updateDayRow(idx, 'time_slot', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        <option value="am">AM</option>
                        <option value="pm">PM</option>
                        <option value="custom">Custom</option>
                      </select>
                      {row.time_slot === 'custom' && (
                        <div className="flex gap-1 mt-1">
                          <input
                            type="time"
                            value={row.override_start_time}
                            onChange={(e) => updateDayRow(idx, 'override_start_time', e.target.value)}
                            className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          />
                          <input
                            type="time"
                            value={row.override_end_time}
                            onChange={(e) => updateDayRow(idx, 'override_end_time', e.target.value)}
                            className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
                Creates {dayRows.length} separate visit slots — one for each cycle week with its own day and time.
              </p>
            </div>
          ) : (
            /* ============================================================
               NORMAL MODE — Single day + cycle week checkboxes
               ============================================================ */
            <>
              {/* Day + Time Slot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Day of Week *</label>
                  <select
                    value={form.day_of_week}
                    onChange={upd('day_of_week')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Time Slot *</label>
                  <select
                    value={form.time_slot}
                    onChange={upd('time_slot')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="am">AM (08:30 – 12:00)</option>
                    <option value="pm">PM (12:30 – 16:00)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Custom times */}
              {form.time_slot === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-indigo-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Start Time</label>
                    <input
                      type="time"
                      value={form.override_start_time}
                      onChange={upd('override_start_time')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">End Time</label>
                    <input
                      type="time"
                      value={form.override_end_time}
                      onChange={upd('override_end_time')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Effective time display */}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Effective time: <span className="font-medium text-slate-700 dark:text-slate-200">{effectiveStart} – {effectiveEnd}</span>
              </div>

              {/* Cycle Weeks */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">Cycle Weeks *</label>
                <div className="flex gap-3 mb-2">
                  {[1, 2, 3, 4].map((week) => {
                    const isSelected = form.cycle_weeks.includes(week)
                    const isDisabled = !isSelected && form.cycle_weeks.length >= maxWeeks
                    return (
                      <label
                        key={week}
                        className={`flex items-center gap-1.5 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleWeek(week)}
                          disabled={isDisabled}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                        />
                        <span className={`text-sm ${isDisabled ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>Week {week}</span>
                      </label>
                    )
                  })}
                </div>
                <p className={`text-xs mb-2 ${form.cycle_weeks.length < maxWeeks ? 'text-amber-600 font-medium dark:text-amber-400' : 'text-slate-400'}`}>
                  {maxWeeks === 1 ? 'Monthly — select 1 cycle week' :
                   maxWeeks === 2 ? `Fortnightly — select ${2 - form.cycle_weeks.length > 0 ? `${2 - form.cycle_weeks.length} more of ` : ''}2 cycle weeks` :
                   maxWeeks === 3 ? `Select ${3 - form.cycle_weeks.length > 0 ? `${3 - form.cycle_weeks.length} more of ` : ''}3 cycle weeks` :
                   `Select ${4 - form.cycle_weeks.length > 0 ? `${4 - form.cycle_weeks.length} more of ` : 'all '}4 cycle weeks`}
                  {form.cycle_weeks.length === maxWeeks && ' ✓'}
                </p>
                {/* Quick-fill buttons */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 self-center">Quick-fill:</span>
                  {quickFillOptions.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => quickFill(opt.weeks)}
                      className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Notes</label>
            <textarea
              value={form.notes}
              onChange={upd('notes')}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
            Cancel
          </button>
          <Button
            onClick={handleSave}
            variant="primary"
            disabled={saving || (!differentDays && form.cycle_weeks.length < maxWeeks)}
          >
            {saving ? 'Saving...' : differentDays ? `Create ${dayRows.length} Slots` : isWeekdays ? 'Create 5 Slots' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
