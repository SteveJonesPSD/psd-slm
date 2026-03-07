'use client'

import React, { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Badge, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'
import { dragAssignJob } from '../actions'
import { EditActivityModal } from '../edit-activity-modal'

// Use noon to avoid DST midnight shifts when doing date arithmetic
function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return formatDateLocal(d)
}

export interface UserWorkingHoursData {
  user_id: string
  day_of_week: number
  is_working_day: boolean
  start_time: string | null
  end_time: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function WeekView({ allJobs, allActivities, engineers, initialWeekStart, canEdit, workingDays = [1, 2, 3, 4, 5], allUserHours, activityTypes }: {
  allJobs: any[]
  allActivities?: any[]
  engineers: any[]
  initialWeekStart: string
  canEdit: boolean
  workingDays?: number[]
  allUserHours?: UserWorkingHoursData[]
  activityTypes?: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Persist week position: URL param > initial prop
  const paramWeek = searchParams.get('week')
  const [weekStart, setWeekStartState] = useState(paramWeek || initialWeekStart)
  const [activeJob, setActiveJob] = useState<string | null>(null)
  const [editingActivity, setEditingActivity] = useState<any | null>(null)

  // Update URL search param when week changes (replaces history entry, no navigation)
  function setWeekStart(newWeek: string) {
    setWeekStartState(newWeek)
    const url = new URL(window.location.href)
    url.searchParams.set('week', newWeek)
    window.history.replaceState({}, '', url.toString())
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Generate days for the working week (Mon=1 ... Sun=7)
  const weekDays = useMemo(() => {
    const days: { date: string; label: string; isToday: boolean }[] = []
    const today = formatDateLocal(new Date())
    // Always iterate Mon(0) through Sun(6) relative to weekStart (which is a Monday)
    for (let i = 0; i < 7; i++) {
      const isoDay = i + 1 // 1=Mon ... 7=Sun
      if (!workingDays.includes(isoDay)) continue
      const d = parseDate(weekStart)
      d.setDate(d.getDate() + i)
      const dateStr = formatDateLocal(d)
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        isToday: dateStr === today,
      })
    }
    return days
  }, [weekStart, workingDays])

  const dayCount = weekDays.length

  function navigateWeek(direction: number) {
    const d = parseDate(weekStart)
    d.setDate(d.getDate() + direction * 7)
    setWeekStart(formatDateLocal(d))
  }

  function goThisWeek() {
    setWeekStart(getMondayOf(new Date()))
  }

  function handleDatePick(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    const picked = parseDate(val)
    setWeekStart(getMondayOf(picked))
  }

  const draggedJob = useMemo(() => {
    if (!activeJob) return null
    return allJobs.find(j => j.id === activeJob) || null
  }, [activeJob, allJobs])

  function handleDragStart(event: DragStartEvent) {
    setActiveJob(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null)
    const { active, over } = event
    if (!over || !canEdit) return

    const jobId = active.id as string
    const dropId = over.id as string

    // dropId = "week-{engineerId}-{date}"
    if (dropId.startsWith('week-')) {
      const parts = dropId.replace('week-', '').split('-date-')
      const engineerId = parts[0]
      const date = parts[1]
      // Keep existing time or default to 09:00
      const job = allJobs.find(j => j.id === jobId)
      const time = job?.scheduled_time?.substring(0, 5) || '09:00'
      await dragAssignJob(jobId, engineerId, date, time)
      router.refresh()
    }
  }

  const weekLabel = weekDays.length > 0 ? `${weekDays[0].label} — ${weekDays[weekDays.length - 1].label}` : ''

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">&larr;</button>
          <button onClick={goThisWeek} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50">This Week</button>
          <button onClick={() => navigateWeek(1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">&rarr;</button>
          <span className="ml-2 text-sm font-semibold text-slate-900">{weekLabel}</span>
          <input
            ref={dateInputRef}
            type="date"
            value={weekStart}
            onChange={handleDatePick}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-slate-700 hover:bg-gray-50 cursor-pointer ml-1"
            title="Jump to week containing this date"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-300 p-0.5">
          <Link href="/scheduling/day" className="rounded-md px-3 py-1 text-sm font-medium no-underline text-slate-600 hover:bg-gray-100">Day</Link>
          <button className="rounded-md px-3 py-1 text-sm font-medium bg-indigo-600 text-white">Week</button>
          <Link href="/scheduling/list" className="rounded-md px-3 py-1 text-sm font-medium no-underline text-slate-600 hover:bg-gray-100">List</Link>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {/* Header */}
          <div className="flex border-b border-gray-200">
            <div className="w-40 shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-slate-500">
              Engineer
            </div>
            {weekDays.map(day => (
              <div
                key={day.date}
                className={`flex-1 border-r border-gray-200 px-2 py-2 text-center text-xs font-semibold ${
                  day.isToday ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-slate-600'
                }`}
                style={{ minWidth: dayCount <= 5 ? 160 : dayCount <= 6 ? 130 : 110 }}
              >
                {day.label}
              </div>
            ))}
          </div>

          {/* Engineer rows */}
          {engineers.map(eng => (
            <div key={eng.id} className="flex border-b border-gray-100">
              <div className="w-40 shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: eng.color || '#6366f1' }}
                >
                  {eng.initials || (eng.first_name[0] + eng.last_name[0])}
                </div>
                <span className="text-xs font-medium text-slate-700 truncate">{eng.first_name}</span>
              </div>
              {weekDays.map(day => {
                const dayJobs = allJobs.filter(
                  j => j.scheduled_date === day.date && j.assigned_to === eng.id && j.status !== 'cancelled'
                )
                const dayActivities = (allActivities || []).filter(
                  (a: { scheduled_date: string; engineer_id: string }) => a.scheduled_date === day.date && a.engineer_id === eng.id
                )
                // Check if this is a non-working day for this engineer
                const dayDate = parseDate(day.date)
                const jsDay = dayDate.getDay()
                const isoDay = jsDay === 0 ? 7 : jsDay
                const userRow = allUserHours?.find(h => h.user_id === eng.id && h.day_of_week === isoDay)
                const isNonWorkingDay = userRow ? !userRow.is_working_day : false

                return (
                  <WeekDayCell
                    key={day.date}
                    engineerId={eng.id}
                    date={day.date}
                    isToday={day.isToday}
                    jobs={dayJobs}
                    activities={dayActivities}
                    canEdit={canEdit}
                    minWidth={dayCount <= 5 ? 160 : dayCount <= 6 ? 130 : 110}
                    isNonWorkingDay={isNonWorkingDay}
                    onActivityClick={canEdit ? setEditingActivity : undefined}
                  />
                )
              })}
            </div>
          ))}

          {engineers.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No engineers found
            </div>
          )}
        </div>

        <DragOverlay>
          {draggedJob && (
            <div
              className="rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg opacity-80"
              style={{ backgroundColor: draggedJob.job_type?.color || '#6b7280', minWidth: 100 }}
            >
              {draggedJob.company?.name || 'Job'}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingActivity && activityTypes && (
        <EditActivityModal
          activity={editingActivity}
          activityTypes={activityTypes}
          engineers={engineers.map((e: any) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name }))}
          onClose={() => setEditingActivity(null)}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeekDayCell({ engineerId, date, isToday, jobs, activities, canEdit, minWidth, isNonWorkingDay, onActivityClick }: { engineerId: string; date: string; isToday: boolean; jobs: any[]; activities: any[]; canEdit: boolean; minWidth: number; isNonWorkingDay?: boolean; onActivityClick?: (activity: any) => void }) {
  const id = `week-${engineerId}-date-${date}`
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canEdit || isNonWorkingDay })

  if (isNonWorkingDay) {
    return (
      <div
        className="flex-1 border-r border-gray-200 p-1.5 min-h-[60px] relative"
        style={{
          minWidth,
          background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(100,116,139,0.10) 4px, rgba(100,116,139,0.10) 8px)',
          backgroundColor: 'rgba(100,116,139,0.06)',
        }}
        title="Not working this day"
      >
        <span className="text-[10px] text-slate-400 dark:text-slate-500">Not working</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 border-r border-gray-200 p-1.5 min-h-[60px] transition-colors ${
        isOver ? 'bg-indigo-50' : isToday ? 'bg-indigo-50/30' : ''
      }`}
      style={{ minWidth }}
    >
      <div className="space-y-1">
        {activities.map((act: { id: string; title: string; all_day: boolean; scheduled_time: string | null; duration_minutes: number; activity_type: { name: string; color: string; background: string } | null }) => (
          <WeekActivityBlock key={act.id} activity={act} onClick={onActivityClick ? () => onActivityClick(act) : undefined} />
        ))}
        {jobs.map(job => (
          <WeekJobBlock key={job.id} job={job} canEdit={canEdit} />
        ))}
      </div>
    </div>
  )
}

// Status-based styling for job blocks
function getWeekBlockStatus(job: { status: string; validated_at?: string | null }) {
  if (job.validated_at) return 'validated'
  return job.status
}

function getWeekBlockStyles(status: string, jtColor: string): React.CSSProperties {
  switch (status) {
    case 'travelling':
      return { backgroundColor: jtColor, borderLeft: '3px solid #d97706' }
    case 'on_site':
      return { backgroundColor: jtColor, borderLeft: '3px solid #7c3aed' }
    case 'completed':
      return { backgroundColor: '#059669' }
    case 'validated':
      return { backgroundColor: '#2563eb' }
    default:
      return { backgroundColor: jtColor }
  }
}

function WeekStockIcon({ collectionStatus, soNumbers }: { collectionStatus: 'none' | 'pending' | 'collected'; soNumbers: string[] }) {
  const collected = collectionStatus === 'collected'
  const color = collected ? '#4ade80' : '#fca5a5'
  const soLabel = soNumbers.length > 0 ? soNumbers.join(', ') : ''
  const tooltip = collected
    ? `Stock collected${soLabel ? ` — ${soLabel}` : ''}`
    : `Stock not yet collected${soLabel ? ` — ${soLabel}` : ''}`
  return (
    <span title={tooltip} className={`shrink-0 ml-auto${collected ? '' : ' animate-pulse'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={color} className="w-3 h-3 drop-shadow-sm">
        <path d="M.41 4.44A1.5 1.5 0 0 1 1.5 3h17a1.5 1.5 0 0 1 1.09.44l.01.01A1.5 1.5 0 0 1 20 4.5V6a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4.5c0-.38.14-.74.41-1.01v-.05ZM1 8.5h18v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 1 15.5v-7Zm7 2a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5H8Z" />
      </svg>
    </span>
  )
}

function WeekBlockIcon({ status }: { status: string }) {
  if (status === 'travelling' || status === 'on_site') {
    return <span className="text-[8px]">&#9654;</span>
  }
  if (status === 'completed') {
    return <span className="text-[8px]">&#10003;</span>
  }
  if (status === 'validated') {
    return <span className="text-[8px]">&#10003;&#10003;</span>
  }
  return null
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeekJobBlock({ job, canEdit }: { job: any; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit || job.status === 'completed' || job.status === 'cancelled',
  })

  const jt = job.job_type
  const blockStatus = getWeekBlockStatus(job)
  const collectionStatus: 'none' | 'pending' | 'collected' = job._collectionStatus ?? 'none'
  const soNumbers: string[] = job._soNumbers ?? []
  const statusStyles = getWeekBlockStyles(blockStatus, jt?.color || '#6b7280')
  const isPulsing = blockStatus === 'travelling' || blockStatus === 'on_site'

  // Calculate end time
  let timeLabel = ''
  if (job.scheduled_time) {
    const [hours, minutes] = job.scheduled_time.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + (job.estimated_duration_minutes || 60)
    const endH = Math.floor(endMinutes / 60)
    const endM = endMinutes % 60
    timeLabel = `${job.scheduled_time.substring(0, 5)}–${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  // Actual times
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const actualStart = job.travel_started_at ? fmt(job.travel_started_at) : job.arrived_at ? fmt(job.arrived_at) : null
  const actualEnd = job.completed_at ? fmt(job.completed_at) : null

  return (
    <Link
      ref={setNodeRef}
      href={`/scheduling/jobs/${job.id}`}
      {...attributes}
      {...listeners}
      className={`block rounded px-1.5 py-1 text-[10px] font-medium text-white no-underline transition-opacity ${
        isDragging ? 'opacity-50' : 'hover:opacity-90'
      } ${canEdit && job.status !== 'completed' ? 'cursor-grab' : 'cursor-pointer'}${
        isPulsing ? ' animate-pulse' : ''
      }`}
      style={{
        ...statusStyles,
        ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
      }}
      title={job.title}
    >
      <div className="flex items-center gap-1">
        <WeekBlockIcon status={blockStatus} />
        <span className="truncate">{job.company?.name}</span>
        {job._hasSo && <WeekStockIcon collectionStatus={collectionStatus} soNumbers={soNumbers} />}
      </div>
      {timeLabel && (
        <span className="text-[9px] opacity-75 block">Booked: {timeLabel}</span>
      )}
      {(actualStart || actualEnd) && (
        <span className="text-[8px] opacity-60 block">
          Actual: {actualStart && actualEnd
            ? `${actualStart}–${actualEnd}`
            : actualStart
              ? `${actualStart}–`
              : `–${actualEnd}`}
        </span>
      )}
    </Link>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeekActivityBlock({ activity, onClick }: { activity: any; onClick?: () => void }) {
  const at = activity.activity_type
  const color = at?.color || '#6b7280'
  const bg = at?.background || '#f3f4f6'

  let timeLabel = ''
  if (activity.all_day) {
    timeLabel = 'All day'
  } else if (activity.scheduled_time) {
    const [hours, minutes] = activity.scheduled_time.split(':').map(Number)
    const endMin = hours * 60 + minutes + (activity.duration_minutes || 60)
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    timeLabel = `${activity.scheduled_time.substring(0, 5)}–${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  return (
    <div
      className={`block rounded px-1.5 py-1 text-[10px] font-medium no-underline border-2 border-dashed${onClick ? ' cursor-pointer hover:opacity-80' : ''}`}
      style={{ color, backgroundColor: bg, borderColor: color }}
      title={`${activity.title}${timeLabel ? ` (${timeLabel})` : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span className="text-[8px]">&#9632;</span>
        <span className="truncate">{activity.title}</span>
      </div>
      {timeLabel && (
        <span className="text-[9px] opacity-75 block">{timeLabel}</span>
      )}
    </div>
  )
}
