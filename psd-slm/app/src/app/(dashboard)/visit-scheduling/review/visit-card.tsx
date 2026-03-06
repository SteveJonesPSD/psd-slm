'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, VISIT_STATUS_CONFIG, TIME_SLOT_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cancelVisit, completeVisit, rescheduleVisit, updateVisitTimes } from '../actions'
import type { VisitInstanceWithDetails } from '@/lib/visit-scheduling/types'

interface VisitCardProps {
  visit: VisitInstanceWithDetails
}

export function VisitCard({ visit }: VisitCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const statusCfg = VISIT_STATUS_CONFIG[visit.status]
  const slotCfg = TIME_SLOT_CONFIG[visit.time_slot]

  function handleCancel() {
    if (!confirm('Cancel this visit?')) return
    setError(null)
    startTransition(async () => {
      const res = await cancelVisit(visit.id)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function handleComplete() {
    setError(null)
    startTransition(async () => {
      const res = await completeVisit(visit.id)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function handleReschedule() {
    if (!newDate) return
    setError(null)
    startTransition(async () => {
      const res = await rescheduleVisit(visit.id, newDate)
      if (res.error) setError(res.error)
      else {
        setShowReschedule(false)
        router.refresh()
      }
    })
  }

  const isActive = visit.status === 'draft' || visit.status === 'confirmed'

  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-xs transition-colors cursor-pointer"
      style={{
        borderColor: statusCfg?.color || '#e2e8f0',
        backgroundColor: statusCfg?.bg || '#f8fafc',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
          {visit.customer_name}
        </div>
        {statusCfg && (
          <Badge
            label={statusCfg.label}
            color={statusCfg.color}
            bg={statusCfg.bg}
            className="text-[9px] px-1.5 py-0 flex-shrink-0"
          />
        )}
      </div>

      <div className="flex items-center gap-1 mt-1">
        {slotCfg && (
          <Badge label={slotCfg.label} color={slotCfg.color} bg={slotCfg.bg} className="text-[9px] px-1.5 py-0" />
        )}
        {visit.start_time && visit.end_time && (
          <span className="text-[10px] text-slate-500 dark:text-slate-300">
            {visit.start_time.slice(0, 5)}–{visit.end_time.slice(0, 5)}
          </span>
        )}
        {visit.is_bank_holiday && (
          <span className="text-[9px] text-red-600 font-semibold">BH</span>
        )}
      </div>

      {visit.contract_number && (
        <div className="text-[10px] text-slate-500 dark:text-slate-300 mt-0.5">{visit.contract_number}</div>
      )}

      {visit.job_id && visit.job_number && (
        <a
          href={`/scheduling/jobs/${visit.job_id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-block text-[10px] text-indigo-600 hover:text-indigo-800 font-medium mt-0.5"
        >
          {visit.job_number}
        </a>
      )}

      {/* Expanded actions */}
      {expanded && isActive && (
        <div className="mt-2 pt-2 border-t border-slate-200/50 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {error && (
            <div className="text-[10px] text-red-600">{error}</div>
          )}

          {!showReschedule ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleComplete}
                disabled={isPending}
                className="rounded bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-medium hover:bg-green-200 disabled:opacity-50"
              >
                Complete
              </button>
              <button
                onClick={() => setShowReschedule(true)}
                disabled={isPending}
                className="rounded bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-medium hover:bg-blue-200 disabled:opacity-50"
              >
                Reschedule
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="rounded bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium hover:bg-red-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] w-28"
              />
              <Button
                onClick={handleReschedule}
                variant="primary"
                size="sm"
                disabled={isPending || !newDate}
                className="!text-[10px] !px-2 !py-0.5"
              >
                Move
              </Button>
              <button
                onClick={() => setShowReschedule(false)}
                className="text-[10px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
