'use client'

import { Badge, VISIT_STATUS_CONFIG, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { CollapsibleCard } from './collapsible-card'
import type { VisitInstanceWithDetails } from '@/lib/visit-scheduling/types'

interface VisitSchedulingSectionProps {
  visits: VisitInstanceWithDetails[]
}

export function VisitSchedulingSection({ visits }: VisitSchedulingSectionProps) {
  const upcoming = visits.filter(v =>
    v.visit_date >= new Date().toISOString().split('T')[0] &&
    v.status !== 'cancelled' && v.status !== 'rescheduled'
  ).sort((a, b) => a.visit_date.localeCompare(b.visit_date))

  const past = visits.filter(v =>
    v.visit_date < new Date().toISOString().split('T')[0] ||
    v.status === 'completed'
  ).sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 10)

  return (
    <CollapsibleCard title="Scheduled Visits" count={upcoming.length}>
      {visits.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          No scheduled visits for this customer.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {/* Upcoming visits */}
          {upcoming.length > 0 && (
            <div className="px-5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Upcoming</div>
              <div className="space-y-2">
                {upcoming.slice(0, 12).map(visit => {
                  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
                  const slotCfg = TIME_SLOT_CONFIG[visit.time_slot]
                  return (
                    <div key={visit.id} className="flex items-center gap-3 text-sm">
                      <span className="w-24 whitespace-nowrap text-slate-700">
                        {new Date(visit.visit_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {slotCfg && <Badge label={slotCfg.label} color={slotCfg.color} bg={slotCfg.bg} className="text-[10px]" />}
                      <span className="text-slate-600">{visit.engineer_name}</span>
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} className="text-[10px]" />}
                      {visit.is_bank_holiday && (
                        <span className="text-[10px] text-red-600 font-semibold">Bank Holiday</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Past visits */}
          {past.length > 0 && (
            <div className="px-5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Recent History</div>
              <div className="space-y-2">
                {past.map(visit => {
                  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
                  const slotCfg = TIME_SLOT_CONFIG[visit.time_slot]
                  return (
                    <div key={visit.id} className="flex items-center gap-3 text-sm opacity-70">
                      <span className="w-24 whitespace-nowrap text-slate-500">
                        {new Date(visit.visit_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {slotCfg && <Badge label={slotCfg.label} color={slotCfg.color} bg={slotCfg.bg} className="text-[10px]" />}
                      <span className="text-slate-500">{visit.engineer_name}</span>
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} className="text-[10px]" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleCard>
  )
}
