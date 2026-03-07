'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateUserWorkingHours } from '../../actions'
import type { UserWorkingHoursRow, UserWorkingHoursEntry } from '../../actions'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7]

interface Engineer {
  id: string
  first_name: string
  last_name: string
  initials?: string
  color?: string
  avatar_url?: string | null
}

interface OrgDefaults {
  startTime: string
  endTime: string
  workingDays: number[]
}

interface DayConfig {
  is_working_day: boolean
  start_time: string | null
  end_time: string | null
  is_custom: boolean // has custom times different from org default
}

function buildDayConfigs(
  userId: string,
  allHours: UserWorkingHoursRow[],
  orgDefaults: OrgDefaults
): Record<number, DayConfig> {
  const userRows = allHours.filter(h => h.user_id === userId)
  const configs: Record<number, DayConfig> = {}

  for (const day of DAY_NUMBERS) {
    const row = userRows.find(r => r.day_of_week === day)
    if (row) {
      configs[day] = {
        is_working_day: row.is_working_day,
        start_time: row.start_time,
        end_time: row.end_time,
        is_custom: true,
      }
    } else {
      configs[day] = {
        is_working_day: orgDefaults.workingDays.includes(day),
        start_time: null,
        end_time: null,
        is_custom: false,
      }
    }
  }

  return configs
}

function summariseSchedule(configs: Record<number, DayConfig>, orgDefaults: OrgDefaults): string {
  const workingDays = DAY_NUMBERS.filter(d => configs[d].is_working_day)
  if (workingDays.length === 0) return 'No working days set'

  const dayLabels = workingDays.map(d => DAY_LABELS[d - 1])
  const hasCustomTimes = workingDays.some(d => configs[d].start_time || configs[d].end_time)

  if (!hasCustomTimes) {
    const isOrgDefault = workingDays.length === orgDefaults.workingDays.length &&
      workingDays.every(d => orgDefaults.workingDays.includes(d))
    if (isOrgDefault) return 'Using organisation defaults'
    return dayLabels.join(', ')
  }

  return dayLabels.join(', ') + ' (custom hours)'
}

export function IndividualHoursManager({
  engineers,
  allUserHours,
  orgDefaults,
}: {
  engineers: Engineer[]
  allUserHours: UserWorkingHoursRow[]
  orgDefaults: OrgDefaults
}) {
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [localHours, setLocalHours] = useState<UserWorkingHoursRow[]>(allUserHours)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Individual Working Hours</h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Override the organisation&apos;s default working days and hours for individual team members.
          Defaults: {DAY_NUMBERS.filter(d => orgDefaults.workingDays.includes(d)).map(d => DAY_LABELS[d - 1]).join(', ')}, {orgDefaults.startTime}–{orgDefaults.endTime}
        </p>

        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {engineers.map(eng => {
            const configs = buildDayConfigs(eng.id, localHours, orgDefaults)
            const isEditing = editingUser === eng.id

            return (
              <div key={eng.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: eng.color || '#6366f1' }}
                    >
                      {eng.avatar_url ? (
                        <img src={eng.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        eng.initials || (eng.first_name[0] + eng.last_name[0])
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {eng.first_name} {eng.last_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {summariseSchedule(configs, orgDefaults)}
                      </p>
                    </div>
                  </div>

                  {!isEditing && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setEditingUser(eng.id)}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <EditPanel
                    userId={eng.id}
                    initialConfigs={configs}
                    orgDefaults={orgDefaults}
                    onSave={(entries) => {
                      // Update local state
                      const filtered = localHours.filter(h => h.user_id !== eng.id)
                      const newRows: UserWorkingHoursRow[] = entries
                        .filter(e => !e.is_working_day || e.start_time || e.end_time)
                        .map(e => ({
                          id: '',
                          user_id: eng.id,
                          day_of_week: e.day_of_week,
                          is_working_day: e.is_working_day,
                          start_time: e.start_time,
                          end_time: e.end_time,
                        }))
                      setLocalHours([...filtered, ...newRows])
                      setEditingUser(null)
                    }}
                    onCancel={() => setEditingUser(null)}
                  />
                )}
              </div>
            )
          })}

          {engineers.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No engineers found. Users in Infrastructure or Engineering teams will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function EditPanel({
  userId,
  initialConfigs,
  orgDefaults,
  onSave,
  onCancel,
}: {
  userId: string
  initialConfigs: Record<number, DayConfig>
  orgDefaults: OrgDefaults
  onSave: (entries: UserWorkingHoursEntry[]) => void
  onCancel: () => void
}) {
  const [configs, setConfigs] = useState<Record<number, DayConfig>>(() => ({ ...initialConfigs }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateDay(day: number, updates: Partial<DayConfig>) {
    setConfigs(prev => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }))
  }

  function resetToDefaults() {
    const defaults: Record<number, DayConfig> = {}
    for (const day of DAY_NUMBERS) {
      defaults[day] = {
        is_working_day: orgDefaults.workingDays.includes(day),
        start_time: null,
        end_time: null,
        is_custom: false,
      }
    }
    setConfigs(defaults)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const entries: UserWorkingHoursEntry[] = DAY_NUMBERS.map(day => ({
      day_of_week: day,
      is_working_day: configs[day].is_working_day,
      start_time: configs[day].is_working_day ? (configs[day].start_time || null) : null,
      end_time: configs[day].is_working_day ? (configs[day].end_time || null) : null,
    }))

    const result = await updateUserWorkingHours(userId, entries)
    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else {
      onSave(entries)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {DAY_NUMBERS.map(day => {
          const cfg = configs[day]
          const isOrgDefault = orgDefaults.workingDays.includes(day)

          return (
            <div key={day} className="flex flex-wrap items-center gap-3">
              {/* Day toggle */}
              <label className="flex w-16 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={cfg.is_working_day}
                  onChange={e => updateDay(day, {
                    is_working_day: e.target.checked,
                    is_custom: true,
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-sm font-medium ${cfg.is_working_day ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                  {DAY_LABELS[day - 1]}
                </span>
              </label>

              {/* Time inputs — only shown for working days */}
              {cfg.is_working_day && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={cfg.start_time || orgDefaults.startTime}
                    onChange={e => {
                      const val = e.target.value
                      updateDay(day, {
                        start_time: val === orgDefaults.startTime ? null : val,
                        is_custom: true,
                      })
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={cfg.end_time || orgDefaults.endTime}
                    onChange={e => {
                      const val = e.target.value
                      updateDay(day, {
                        end_time: val === orgDefaults.endTime ? null : val,
                        is_custom: true,
                      })
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  {(cfg.start_time || cfg.end_time) && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">Custom</span>
                  )}
                </div>
              )}

              {!cfg.is_working_day && isOrgDefault && (
                <span className="text-[10px] text-red-500 dark:text-red-400">Not working (override)</span>
              )}

              {!cfg.is_working_day && !isOrgDefault && (
                <span className="text-[10px] text-slate-400">Not a working day</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-slate-500 hover:text-slate-700 underline dark:text-slate-400 dark:hover:text-slate-300"
        >
          Reset to organisation defaults
        </button>

        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
