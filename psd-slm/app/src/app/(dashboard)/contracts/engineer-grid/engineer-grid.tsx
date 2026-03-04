'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { getEngineerSlots } from '../actions'
import type { ContractVisitSlotWithDetails, FieldEngineer } from '@/lib/contracts/types'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
}

const SLOT_BG: Record<string, string> = {
  am: 'bg-blue-50 border-blue-200',
  pm: 'bg-amber-50 border-amber-200',
  custom: 'bg-emerald-50 border-emerald-200',
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

interface EngineerGridProps {
  engineers: FieldEngineer[]
}

export function EngineerGrid({ engineers }: EngineerGridProps) {
  const router = useRouter()
  const [selectedEngineerId, setSelectedEngineerId] = useState(engineers[0]?.id || '')
  const [slots, setSlots] = useState<ContractVisitSlotWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  const selectedEngineer = engineers.find((e) => e.id === selectedEngineerId)

  useEffect(() => {
    if (!selectedEngineerId) return
    setLoading(true)
    getEngineerSlots(selectedEngineerId).then((data) => {
      setSlots(data)
      setLoading(false)
    })
  }, [selectedEngineerId])

  // Build grid: week (1-4) × day → slots[]
  const grid: Record<number, Record<string, ContractVisitSlotWithDetails[]>> = {}
  for (let w = 1; w <= 4; w++) {
    grid[w] = {}
    for (const d of DAYS) grid[w][d] = []
  }

  for (const slot of slots) {
    for (const week of slot.cycle_week_numbers || []) {
      if (week >= 1 && week <= 4 && grid[week][slot.day_of_week]) {
        grid[week][slot.day_of_week].push(slot)
      }
    }
  }

  // Calculate capacity per day (max slots across all weeks for that day)
  const dayCapacity: Record<string, number> = {}
  for (const d of DAYS) {
    let max = 0
    for (let w = 1; w <= 4; w++) {
      if (grid[w][d].length > max) max = grid[w][d].length
    }
    dayCapacity[d] = max
  }

  return (
    <div>
      {/* Engineer selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Select Engineer</label>
        <select
          value={selectedEngineerId}
          onChange={(e) => setSelectedEngineerId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none w-full sm:w-64"
        >
          {engineers.length === 0 && <option value="">No engineers found</option>}
          {engineers.map((eng) => (
            <option key={eng.id} value={eng.id}>
              {eng.first_name} {eng.last_name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-sm text-slate-500 py-8 text-center">Loading schedule...</div>
      )}

      {!loading && selectedEngineer && (
        <>
          {/* Engineer name header */}
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              {selectedEngineer.first_name} {selectedEngineer.last_name} — 4-Week Cycle Pattern
            </h2>
            {slots.length === 0 && (
              <p className="text-sm text-slate-500 mt-1">No visit slots configured for this engineer.</p>
            )}
          </div>

          {slots.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50">
                    <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">
                      Week
                    </th>
                    {DAYS.map((d) => (
                      <th key={d} className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <div className="flex items-center justify-between">
                          <span>{DAY_LABELS[d]}</span>
                          {dayCapacity[d] > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal normal-case">
                              {dayCapacity[d]} slot{dayCapacity[d] !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((week) => (
                    <tr key={week} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 px-4 align-top">
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          Wk {week}
                        </span>
                      </td>
                      {DAYS.map((day) => {
                        const cellSlots = grid[week][day]
                        return (
                          <td key={day} className="py-2 px-2 align-top">
                            <div className="flex flex-col gap-1.5">
                              {cellSlots.map((slot) => {
                                const bgClass = SLOT_BG[slot.time_slot] || SLOT_BG.am
                                const timeCfg = TIME_SLOT_CONFIG[slot.time_slot]

                                return (
                                  <button
                                    key={`${slot.id}-${week}`}
                                    onClick={() => router.push(`/contracts/${slot.customer_contract_id}`)}
                                    className={`${bgClass} rounded-lg border p-2.5 text-left w-full hover:shadow-sm transition-shadow cursor-pointer`}
                                  >
                                    <div className="font-semibold text-sm text-slate-900 truncate">
                                      {slot.customer_name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {timeCfg && (
                                        <Badge label={timeCfg.label} color={timeCfg.color} bg={timeCfg.bg} className="text-[10px]" />
                                      )}
                                      <span className="text-xs text-slate-500">
                                        {formatTime(slot.effective_start_time)}&ndash;{formatTime(slot.effective_end_time)}
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      <span className="text-[11px] text-slate-500">
                                        {slot.contract_type_name}
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                              {cellSlots.length === 0 && (
                                <div className="h-8" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {slots.length > 0 && (
            <div className="mt-4 text-sm text-slate-500">
              {(() => {
                const totalVisitsPerCycle = slots.reduce((sum, s) => sum + (s.cycle_week_numbers?.length || 0), 0)
                const uniqueCustomers = new Set(slots.map((s) => s.customer_name)).size
                return (
                  <>
                    <span className="font-semibold text-slate-700">{uniqueCustomers}</span> customer{uniqueCustomers !== 1 ? 's' : ''},{' '}
                    <span className="font-semibold text-slate-700">{totalVisitsPerCycle}</span> visits per 4-week cycle,{' '}
                    <span className="font-semibold text-slate-700">{Math.round(totalVisitsPerCycle * (36 / 4))}</span> per year (36-week calendar)
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
