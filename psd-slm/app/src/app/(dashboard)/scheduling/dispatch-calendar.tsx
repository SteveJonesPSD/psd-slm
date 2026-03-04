'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { dragAssignJob, dragUnscheduleJob } from './actions'

const HOURS_START = 7
const HOURS_END = 19
const SLOT_WIDTH = 60 // px per 30min
const SLOTS_COUNT = (HOURS_END - HOURS_START) * 2
const ENGINEER_ROW_HEIGHT = 56

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DispatchCalendar({ allJobs, jobTypes, engineers, initialDate, canEdit }: {
  allJobs: any[]
  jobTypes: any[]
  engineers: any[]
  initialDate: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [activeJob, setActiveJob] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Filter jobs for the current date
  const dayJobs = useMemo(() => allJobs.filter(j => j.scheduled_date === currentDate && j.status !== 'cancelled'), [allJobs, currentDate])
  const unscheduledJobs = useMemo(() => allJobs.filter(j => j.status === 'unscheduled'), [allJobs])
  const completedToday = useMemo(() => dayJobs.filter(j => j.status === 'completed').length, [dayJobs])
  const onDutyEngineers = useMemo(() => new Set(dayJobs.map(j => j.assigned_to).filter(Boolean)).size, [dayJobs])

  const dateObj = new Date(currentDate + 'T12:00:00')
  const dateLabel = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  function navigate(direction: number) {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() + direction)
    setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  function goToday() {
    const now = new Date()
    setCurrentDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
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

    // Drop back to pool
    if (dropId === 'job-pool') {
      await dragUnscheduleJob(jobId)
      router.refresh()
      return
    }

    // Drop onto timeline: dropId = "engineer-{id}-slot-{index}"
    if (dropId.startsWith('engineer-')) {
      const parts = dropId.split('-slot-')
      const engineerId = parts[0].replace('engineer-', '')
      const slotIndex = parseInt(parts[1])
      const hours = HOURS_START + Math.floor(slotIndex / 2)
      const minutes = (slotIndex % 2) * 30
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

      await dragAssignJob(jobId, engineerId, currentDate, time)
      router.refresh()
    }
  }

  return (
    <div>
      {/* Stat Bar */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today's Jobs" value={dayJobs.length} accent="#2563eb" />
        <StatCard label="Unscheduled" value={unscheduledJobs.length} accent={unscheduledJobs.length > 0 ? '#d97706' : '#6b7280'} />
        <StatCard label="Engineers on Duty" value={onDutyEngineers} accent="#7c3aed" />
        <StatCard label="Completed Today" value={completedToday} accent="#059669" />
      </div>

      {/* Top Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">&larr;</button>
          <button onClick={goToday} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50">Today</button>
          <button onClick={() => navigate(1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">&rarr;</button>
          <span className="ml-2 text-sm font-semibold text-slate-900">{dateLabel}</span>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-300 p-0.5">
          <button className="rounded-md px-3 py-1 text-sm font-medium bg-indigo-600 text-white">Day</button>
          <Link href="/scheduling" className="rounded-md px-3 py-1 text-sm font-medium no-underline text-slate-600 hover:bg-gray-100">Week</Link>
          <Link href="/scheduling/list" className="rounded-md px-3 py-1 text-sm font-medium no-underline text-slate-600 hover:bg-gray-100">List</Link>
        </div>
      </div>

      {/* Calendar */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {/* Job Pool */}
          <JobPool jobs={unscheduledJobs} canEdit={canEdit} />

          {/* Timeline */}
          <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {/* Time Header */}
            <div className="flex border-b border-gray-200">
              <div className="w-40 shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-slate-500">
                Engineer
              </div>
              <div className="flex">
                {Array.from({ length: SLOTS_COUNT }, (_, i) => {
                  const hour = HOURS_START + Math.floor(i / 2)
                  const isHour = i % 2 === 0
                  return (
                    <div
                      key={i}
                      className={`shrink-0 border-r py-2 text-center text-[10px] ${isHour ? 'border-gray-300 font-semibold text-slate-600' : 'border-gray-100 text-slate-400'}`}
                      style={{ width: SLOT_WIDTH }}
                    >
                      {isHour ? `${String(hour).padStart(2, '0')}:00` : ''}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Engineer Rows */}
            {engineers.length > 0 ? engineers.map(eng => (
              <EngineerRow
                key={eng.id}
                engineer={eng}
                jobs={dayJobs.filter(j => j.assigned_to === eng.id)}
                canEdit={canEdit}
              />
            )) : (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No engineers found. Users with the Engineering role will appear here.
              </div>
            )}

            {/* Current time indicator */}
            <CurrentTimeIndicator />
          </div>
        </div>

        <DragOverlay>
          {draggedJob && (
            <div
              className="rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg opacity-80"
              style={{ backgroundColor: draggedJob.job_type?.color || '#6b7280', minWidth: 120 }}
            >
              {draggedJob.company?.name || 'Job'} — {draggedJob.job_type?.name || ''}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ============================================================================
// JOB POOL
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobPool({ jobs, canEdit }: { jobs: any[]; canEdit: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'job-pool' })

  return (
    <div
      ref={setNodeRef}
      className={`w-64 shrink-0 rounded-lg border bg-white p-3 transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Unscheduled Jobs</h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
          {jobs.length}
        </span>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {jobs.map(job => (
          <PoolJobCard key={job.id} job={job} canEdit={canEdit} />
        ))}
        {jobs.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">All jobs scheduled</p>
        )}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PoolJobCard({ job, canEdit }: { job: any; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit,
  })

  const priorityCfg = JOB_PRIORITY_CONFIG[job.priority]
  const jt = job.job_type

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`rounded-lg border p-2.5 transition-shadow ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
      } ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{
        ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
        borderLeftWidth: 3,
        borderLeftColor: priorityCfg?.color || '#6b7280',
      }}
    >
      <p className="text-xs font-medium text-slate-900 truncate">{job.company?.name}</p>
      {jt && <Badge label={jt.name} color={jt.color} bg={jt.background} className="mt-1" />}
      {job.priority === 'high' || job.priority === 'urgent' ? (
        <Badge {...(JOB_PRIORITY_CONFIG[job.priority] || {})} className="mt-1 ml-1" />
      ) : null}
      <p className="mt-1 text-[10px] text-slate-400">{new Date(job.created_at).toLocaleDateString('en-GB')}</p>
    </div>
  )
}

// ============================================================================
// ENGINEER ROW
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EngineerRow({ engineer, jobs, canEdit }: { engineer: any; jobs: any[]; canEdit: boolean }) {
  return (
    <div className="flex border-b border-gray-100" style={{ minHeight: ENGINEER_ROW_HEIGHT }}>
      {/* Engineer label */}
      <div className="w-40 shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0 overflow-hidden"
          style={{ backgroundColor: engineer.color || '#6366f1' }}
        >
          {engineer.avatar_url ? (
            <img src={engineer.avatar_url} alt={`${engineer.first_name} ${engineer.last_name}`} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.textContent = engineer.initials || (engineer.first_name[0] + engineer.last_name[0]) }} />
          ) : (
            engineer.initials || (engineer.first_name[0] + engineer.last_name[0])
          )}
        </div>
        <span className="text-xs font-medium text-slate-700 truncate">{engineer.first_name} {engineer.last_name}</span>
      </div>

      {/* Time slots */}
      <div className="relative flex flex-1">
        {Array.from({ length: SLOTS_COUNT }, (_, i) => (
          <TimeSlot key={i} slotIndex={i} engineerId={engineer.id} canEdit={canEdit} />
        ))}

        {/* Job blocks */}
        {jobs.map(job => (
          <JobBlock key={job.id} job={job} canEdit={canEdit} />
        ))}
      </div>
    </div>
  )
}

function TimeSlot({ slotIndex, engineerId, canEdit }: { slotIndex: number; engineerId: string; canEdit: boolean }) {
  const id = `engineer-${engineerId}-slot-${slotIndex}`
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canEdit })
  const isHour = slotIndex % 2 === 0

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 border-r ${isHour ? 'border-gray-200' : 'border-gray-100'} ${isOver ? 'bg-indigo-50' : ''}`}
      style={{ width: SLOT_WIDTH, height: '100%' }}
    />
  )
}

// Status-based styling for job blocks
function getJobBlockStatus(job: { status: string; validated_at?: string | null }) {
  if (job.validated_at) return 'validated'
  return job.status
}

function getJobBlockStyles(status: string, jtColor: string) {
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

function JobBlockStatusIcon({ status }: { status: string }) {
  if (status === 'travelling' || status === 'on_site') {
    return <span className="shrink-0 text-[9px]" aria-label="In progress">&#9654;</span>
  }
  if (status === 'completed') {
    return <span className="shrink-0 text-[9px]" aria-label="Completed">&#10003;</span>
  }
  if (status === 'validated') {
    return <span className="shrink-0 text-[9px]" aria-label="Validated">&#10003;&#10003;</span>
  }
  return null
}

function formatActualTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobBlock({ job, canEdit }: { job: any; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit || job.status === 'completed' || job.status === 'cancelled',
  })

  if (!job.scheduled_time) return null

  const [hours, minutes] = job.scheduled_time.split(':').map(Number)
  const startSlot = (hours - HOURS_START) * 2 + (minutes >= 30 ? 1 : 0)
  const durationSlots = Math.max(1, Math.ceil(job.estimated_duration_minutes / 30))

  const left = startSlot * SLOT_WIDTH
  const width = durationSlots * SLOT_WIDTH - 4

  if (startSlot < 0) return null

  // Calculate end time
  const startMinutes = hours * 60 + minutes
  const endMinutes = startMinutes + (job.estimated_duration_minutes || 60)
  const endH = Math.floor(endMinutes / 60)
  const endM = endMinutes % 60
  const startLabel = job.scheduled_time.substring(0, 5)
  const endLabel = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

  const jt = job.job_type
  const blockStatus = getJobBlockStatus(job)
  const statusStyles = getJobBlockStyles(blockStatus, jt?.color || '#6b7280')

  // Actual times
  const actualStart = formatActualTime(job.travel_started_at) || formatActualTime(job.arrived_at)
  const actualEnd = formatActualTime(job.completed_at)

  const isPulsing = blockStatus === 'travelling' || blockStatus === 'on_site'

  const style = {
    position: 'absolute' as const,
    left: left + 2,
    top: 4,
    width,
    height: ENGINEER_ROW_HEIGHT - 12,
    ...statusStyles,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
  }

  return (
    <Link
      ref={setNodeRef}
      href={`/scheduling/jobs/${job.id}`}
      {...attributes}
      {...listeners}
      style={style}
      className={`flex items-center gap-1 rounded-md px-2 text-[11px] font-medium text-white shadow-sm no-underline transition-opacity ${
        isDragging ? 'opacity-50 z-50' : 'hover:opacity-90'
      } ${canEdit && job.status !== 'completed' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}${
        isPulsing ? ' animate-pulse' : ''
      }`}
      title={`${job.title}\n${job.company?.name}\n${startLabel}–${endLabel}\n${JOB_STATUS_CONFIG[job.status]?.label || job.status}`}
    >
      <JobBlockStatusIcon status={blockStatus} />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-[10px] opacity-80">Booked: {startLabel}–{endLabel}</span>
          <span className="truncate">
            {job.company?.name}
            {(job.priority === 'high' || job.priority === 'urgent') && ' !!!'}
          </span>
        </div>
        {(actualStart || actualEnd) && (
          <span className="text-[9px] opacity-70">
            Actual: {actualStart && actualEnd
              ? `${actualStart}–${actualEnd}`
              : actualStart
                ? `${actualStart}–`
                : `–${actualEnd}`}
          </span>
        )}
      </div>
    </Link>
  )
}

// ============================================================================
// CURRENT TIME INDICATOR
// ============================================================================

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date())
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()

  if (hours < HOURS_START || hours >= HOURS_END) return null

  const slotsFromStart = (hours - HOURS_START) * 2 + minutes / 30
  const left = 160 + slotsFromStart * SLOT_WIDTH // 160 = engineer label width

  return (
    <div
      ref={lineRef}
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
      style={{ left }}
    />
  )
}
