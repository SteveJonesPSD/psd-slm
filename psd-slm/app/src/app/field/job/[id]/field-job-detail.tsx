'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'
import { changeJobStatus, addJobNote, toggleJobTask } from '@/app/(dashboard)/scheduling/actions'
import { useGeoCapture } from '@/lib/use-geo-capture'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FieldJobDetail({ job }: { job: any }) {
  const router = useRouter()
  const { capturePosition, captureWithReason } = useGeoCapture()
  const [changing, setChanging] = useState(false)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<string>('')

  const statusCfg = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: '#6b7280', bg: '#f3f4f6' }
  const priorityCfg = JOB_PRIORITY_CONFIG[job.priority] || { label: job.priority, color: '#6b7280', bg: '#f3f4f6' }
  const jt = job.job_type
  const company = job.company
  const contact = job.contact

  // Build address for mapping apps
  const addressParts = [job.site_address_line1, job.site_address_line2, job.site_city, job.site_county, job.site_postcode].filter(Boolean)
  const fullAddress = addressParts.join(', ')
  const encodedAddress = encodeURIComponent(fullAddress)
  const [showMapPicker, setShowMapPicker] = useState(false)

  const mapLinks = fullAddress ? {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
    apple: `https://maps.apple.com/?daddr=${encodedAddress}`,
    waze: `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
    tesla: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
  } : null

  const durationH = Math.floor(job.estimated_duration_minutes / 60)
  const durationM = job.estimated_duration_minutes % 60
  const durationStr = durationH > 0 ? `${durationH}h${durationM > 0 ? ` ${durationM}m` : ''}` : `${durationM}m`

  async function captureWithFeedback() {
    setGpsStatus('capturing')
    const result = await captureWithReason()
    if (result.coords) {
      setGpsStatus('captured')
    } else {
      const messages: Record<string, string> = {
        permission_denied: 'Location permission denied',
        position_unavailable: 'Location not available on this device',
        timeout: 'Location request timed out',
        not_supported: 'Geolocation not supported',
      }
      setGpsStatus(messages[result.error || ''] || 'Location unavailable')
    }
    setTimeout(() => setGpsStatus(''), 5000)
    return result.coords
  }

  async function handleStatusAction(newStatus: string) {
    if (newStatus === 'completed') {
      router.push(`/field/job/${job.id}/complete`)
      return
    }
    setChanging(true)
    const gps = await captureWithFeedback()
    const result = await changeJobStatus(job.id, newStatus as 'travelling' | 'on_site' | 'return_travelling' | 'closed', { gps })
    if (!result.error) {
      // Brief delay so GPS feedback is visible before the page re-renders
      await new Promise(r => setTimeout(r, 800))
      router.refresh()
    }
    setChanging(false)
  }

  async function handleAddNote() {
    if (!note.trim()) return
    setSavingNote(true)
    const gps = await captureWithFeedback()
    const result = await addJobNote(job.id, note, gps)
    if (!result.error) {
      setNote('')
      await new Promise(r => setTimeout(r, 800))
      router.refresh()
    }
    setSavingNote(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Back nav */}
      <Link href="/field" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        &larr; Today&apos;s Jobs
      </Link>

      {/* Job header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-slate-400">{job.job_number}</span>
          <Badge {...statusCfg} />
          <Badge {...priorityCfg} />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{job.title}</h1>
      </div>

      {/* Section 1: Status Action Button */}
      <div className="mb-6">
        {job.status === 'scheduled' && (
          <button
            onClick={() => handleStatusAction('travelling')}
            disabled={changing}
            className="w-full rounded-xl bg-amber-500 py-4 text-base font-bold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50"
          >
            {changing ? 'Updating...' : 'Start Travel'}
          </button>
        )}
        {job.status === 'travelling' && (
          <button
            onClick={() => handleStatusAction('on_site')}
            disabled={changing}
            className="w-full rounded-xl bg-purple-600 py-4 text-base font-bold text-white shadow-sm hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50"
          >
            {changing ? 'Updating...' : "I've Arrived"}
          </button>
        )}
        {job.status === 'on_site' && (
          <button
            onClick={() => handleStatusAction('completed')}
            className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white shadow-sm hover:bg-green-700 active:bg-green-800"
          >
            Complete Job
          </button>
        )}
        {job.status === 'completed' && (
          <div className="space-y-3">
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-sm font-semibold text-green-700">Job Completed</p>
              {job.completed_at && (
                <p className="text-xs text-green-600 mt-1">{new Date(job.completed_at).toLocaleString('en-GB')}</p>
              )}
            </div>
            <button
              onClick={() => handleStatusAction('return_travelling')}
              disabled={changing}
              className="w-full rounded-xl bg-amber-500 py-4 text-base font-bold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50"
            >
              {changing ? 'Updating...' : (
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 5h4m4.5 2.5L19 17l-2 2M7 17H4v-2a4 4 0 014-4h1M17 7V4l3 3-3 3" />
                  </svg>
                  Start Return Travel
                </span>
              )}
            </button>
          </div>
        )}
        {job.status === 'return_travelling' && (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm font-semibold text-amber-700">Returning from site</p>
              {job.departed_at && (
                <p className="text-xs text-amber-600 mt-1">Left site: {new Date(job.departed_at).toLocaleString('en-GB')}</p>
              )}
            </div>
            <button
              onClick={() => handleStatusAction('closed')}
              disabled={changing}
              className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {changing ? 'Updating...' : 'End Travel'}
            </button>
          </div>
        )}
        {job.status === 'closed' && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
            <p className="text-sm font-semibold text-blue-700">Job Closed</p>
            {job.return_arrived_at && (
              <p className="text-xs text-blue-600 mt-1">Travel ended: {new Date(job.return_arrived_at).toLocaleString('en-GB')}</p>
            )}
          </div>
        )}
        {/* GPS feedback */}
        {gpsStatus === 'capturing' && (
          <p className="mt-2 text-center text-xs text-slate-400">Capturing location...</p>
        )}
        {gpsStatus === 'captured' && (
          <p className="mt-2 text-center text-xs text-green-600">Location captured</p>
        )}
        {gpsStatus && gpsStatus !== 'capturing' && gpsStatus !== 'captured' && (
          <p className="mt-2 text-center text-xs text-amber-600">{gpsStatus}</p>
        )}
      </div>

      {/* Travel Timeline */}
      {job.travel_started_at && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Timeline</h3>
          <div className="space-y-2">
            {[
              { label: 'Travel started', time: job.travel_started_at, icon: '🚐' },
              { label: 'Arrived on site', time: job.arrived_at, icon: '📍' },
              { label: 'Job completed', time: job.completed_at, icon: '✅' },
              { label: 'Left site', time: job.departed_at, icon: '🚐' },
              { label: 'Travel ended', time: job.return_arrived_at, icon: '🏁' },
            ].filter(e => e.time).map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-5 text-center">{entry.icon}</span>
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-slate-700">{entry.label}</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(entry.time!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Customer Details */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Customer</h3>
        {company && (
          <p className="text-base font-bold text-slate-900 mb-2">{company.name}</p>
        )}
        {contact && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">{contact.first_name} {contact.last_name}</p>
            {contact.job_title && <p className="text-xs text-slate-500">{contact.job_title}</p>}
            {(contact.mobile || contact.phone) && (
              <a
                href={`tel:${contact.mobile || contact.phone}`}
                className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 no-underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {contact.mobile || contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="block text-sm text-indigo-600">
                {contact.email}
              </a>
            )}
          </div>
        )}
        {mapLinks && (
          <div className="mt-3">
            <button
              onClick={() => setShowMapPicker(!showMapPicker)}
              className="w-full flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1">
                {addressParts.map((p, i) => (
                  <span key={i}>{p}{i < addressParts.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform ${showMapPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMapPicker && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <a
                  href={mapLinks.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue-50 dark:bg-blue-900/30 px-3 py-2.5 text-center text-xs font-medium text-blue-700 dark:text-blue-300 no-underline hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200"
                >
                  Google Maps
                </a>
                <a
                  href={mapLinks.apple}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-gray-100 dark:bg-slate-700 px-3 py-2.5 text-center text-xs font-medium text-gray-700 dark:text-slate-200 no-underline hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300"
                >
                  Apple Maps
                </a>
                <a
                  href={mapLinks.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-cyan-50 dark:bg-cyan-900/30 px-3 py-2.5 text-center text-xs font-medium text-cyan-700 dark:text-cyan-300 no-underline hover:bg-cyan-100 dark:hover:bg-cyan-900/50 active:bg-cyan-200"
                >
                  Waze
                </a>
                <a
                  href={mapLinks.tesla}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2.5 text-center text-xs font-medium text-red-700 dark:text-red-300 no-underline hover:bg-red-100 dark:hover:bg-red-900/50 active:bg-red-200"
                >
                  Tesla
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Job Info */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Job Details</h3>
        <div className="flex gap-2 mb-3">
          {jt && <Badge label={jt.name} color={jt.color} bg={jt.background} />}
          <Badge {...priorityCfg} />
          <span className="text-xs text-slate-500">{durationStr}</span>
        </div>
        {job.description && (
          <p className="whitespace-pre-wrap text-sm text-slate-700 mb-3">{job.description}</p>
        )}
        {job.internal_notes && (
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Internal Notes</p>
            <p className="whitespace-pre-wrap text-sm text-amber-800">{job.internal_notes}</p>
          </div>
        )}
      </div>

      {/* Section 4: Tasks */}
      {(job.tasks || []).length > 0 && (
        <FieldTasksCard tasks={job.tasks} capturePosition={capturePosition} onRefresh={() => router.refresh()} />
      )}

      {/* Section 5: Parts */}
      {(job.parts || []).length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Parts</h3>
          <div className="space-y-2">
            {job.parts.map((part: { id: string; product?: { name: string }; description?: string; quantity: number; serial_numbers?: string[] }) => (
              <div key={part.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{part.product?.name || part.description}</span>
                <span className="text-slate-500">x{part.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Site History */}
      {(job.company_history || []).length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Site History</h3>
          <div className="space-y-3">
            {job.company_history.slice(0, 5).map((h: { id: string; job_number: string; job_type_name: string; job_type_color: string; job_type_background: string; scheduled_date: string | null; engineer_first_name: string | null; completion_notes: string | null }) => (
              <div key={h.id} className="border-b border-gray-50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge label={h.job_type_name} color={h.job_type_color} bg={h.job_type_background} />
                  {h.scheduled_date && (
                    <span className="text-xs text-slate-400">{new Date(h.scheduled_date + 'T00:00').toLocaleDateString('en-GB')}</span>
                  )}
                  {h.engineer_first_name && (
                    <span className="text-xs text-slate-400">{h.engineer_first_name}</span>
                  )}
                </div>
                {h.completion_notes && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{h.completion_notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 7: Notes */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">
          Notes {(job.notes || []).length > 0 && `(${job.notes.length})`}
        </h3>
        <div className="space-y-3 mb-4">
          {(job.notes || []).map((n: { id: string; note: string; created_at: string; user: { first_name: string; last_name: string } }) => (
            <div key={n.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-slate-700">{n.user?.first_name}</span>
                <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString('en-GB')}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{n.note}</p>
            </div>
          ))}
          {(job.notes || []).length === 0 && (
            <p className="text-sm text-slate-400">No notes yet</p>
          )}
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleAddNote}
          disabled={savingNote || !note.trim()}
          className="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingNote ? 'Adding...' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FieldTasksCard({ tasks, capturePosition, onRefresh }: { tasks: any[]; capturePosition: () => Promise<import('@/types/database').GpsCoords | null>; onRefresh: () => void }) {
  const [taskResponses, setTaskResponses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const t of tasks) {
      if (t.response_value) init[t.id] = t.response_value
    }
    return init
  })
  const requiredTasks = tasks.filter((t: { is_required: boolean }) => t.is_required)
  const completedRequired = requiredTasks.filter((t: { is_completed: boolean }) => t.is_completed).length
  const completedCount = tasks.filter((t: { is_completed: boolean }) => t.is_completed).length

  async function handleToggle(taskId: string) {
    const gps = await capturePosition()
    await toggleJobTask(taskId, { gps })
    onRefresh()
  }

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const saveTaskResponse = useCallback(async (taskId: string, value: string) => {
    const gps = await capturePosition()
    await toggleJobTask(taskId, { response_value: value || '', gps })
    onRefresh()
  }, [capturePosition, onRefresh])

  function handleTaskResponse(taskId: string, value: string, immediate?: boolean) {
    setTaskResponses(prev => ({ ...prev, [taskId]: value }))
    if (debounceTimers.current[taskId]) clearTimeout(debounceTimers.current[taskId])
    if (immediate) {
      saveTaskResponse(taskId, value)
    } else {
      debounceTimers.current[taskId] = setTimeout(() => saveTaskResponse(taskId, value), 800)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase text-slate-400">Tasks</h3>
        <span className={`text-xs font-medium ${completedCount === tasks.length ? 'text-green-600' : 'text-slate-500'}`}>
          {completedCount}/{tasks.length}
          {requiredTasks.length > 0 && ` (${completedRequired}/${requiredTasks.length} required)`}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mb-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${completedCount === tasks.length ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
        />
      </div>
      <div className="space-y-1">
        {tasks.map((task: { id: string; description: string; is_required: boolean; is_completed: boolean; response_type: string; response_value: string | null }) => (
          <div key={task.id} className="p-2 rounded-lg">
            {task.response_type === 'yes_no' ? (
              <button
                onClick={() => handleToggle(task.id)}
                className="flex items-start gap-3 w-full text-left hover:bg-slate-50 active:bg-slate-100 transition-colors rounded-lg p-1"
              >
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  task.is_completed
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}>
                  {task.is_completed && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${task.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {task.description}
                  {task.is_required && !task.is_completed && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Required
                    </span>
                  )}
                </span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    task.is_completed
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {task.is_completed && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${task.is_completed ? 'text-slate-400' : 'text-slate-700'}`}>
                    {task.description}
                  </span>
                  {task.is_required && !task.is_completed && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Required
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {task.response_type === 'text' ? 'Text' : 'Date'}
                  </span>
                </div>
                {task.response_type === 'text' ? (
                  <input
                    type="text"
                    value={taskResponses[task.id] || ''}
                    onChange={e => handleTaskResponse(task.id, e.target.value)}
                    onBlur={e => handleTaskResponse(task.id, e.target.value, true)}
                    placeholder="Enter response..."
                    className="ml-7 w-[calc(100%-1.75rem)] rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <input
                    type="date"
                    value={taskResponses[task.id] || ''}
                    onChange={e => handleTaskResponse(task.id, e.target.value, true)}
                    className="ml-7 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
