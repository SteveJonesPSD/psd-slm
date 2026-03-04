'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { changeTicketStatus, addMessage, logTime } from '../actions'
import { ACTIVE_STATUSES } from '@/lib/helpdesk'
import type { TicketStatus } from '@/types/database'

interface Job {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  site_location: string | null
  room_number: string | null
  device_description: string | null
  scheduled_date: string | null
  customer_id: string
  customers: { name: string } | null
  contacts: { first_name: string; last_name: string } | null
  assigned: { first_name: string; last_name: string } | null
  ticket_messages: { body: string; sender_type: string; is_internal: boolean; created_at: string }[]
}

export function OnsiteJobsView({ initialJobs, customers }: { initialJobs: Job[]; customers: { id: string; name: string }[] }) {
  const router = useRouter()
  const [customerFilter, setCustomerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [noteJobId, setNoteJobId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [timeJobId, setTimeJobId] = useState<string | null>(null)
  const [timeMinutes, setTimeMinutes] = useState('')
  const [timeDesc, setTimeDesc] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  const filtered = initialJobs.filter(j => {
    if (customerFilter && j.customer_id !== customerFilter) return false
    if (statusFilter && j.status !== statusFilter) return false
    return true
  })

  // Group by customer
  const grouped: Record<string, { name: string; jobs: Job[] }> = {}
  for (const job of filtered) {
    const cid = job.customer_id
    const cname = job.customers?.name || 'Unknown'
    if (!grouped[cid]) grouped[cid] = { name: cname, jobs: [] }
    grouped[cid].jobs.push(job)
  }

  const today = new Date().toISOString().substring(0, 10)

  async function handleStatusChange(jobId: string, newStatus: string) {
    await changeTicketStatus(jobId, newStatus as TicketStatus)
    router.refresh()
  }

  async function handleAddNote() {
    if (!noteJobId || !noteText.trim()) return
    await addMessage(noteJobId, { body: noteText, is_internal: true })
    setNoteJobId(null)
    setNoteText('')
    router.refresh()
  }

  async function handleLogTime() {
    if (!timeJobId || !timeMinutes) return
    await logTime(timeJobId, {
      minutes: parseInt(timeMinutes, 10),
      description: timeDesc || undefined,
      is_billable: true,
      entry_date: new Date().toISOString().substring(0, 10),
    })
    setTimeJobId(null)
    setTimeMinutes('')
    setTimeDesc('')
    router.refresh()
  }

  function getLatestMessage(job: Job) {
    const msgs = (job.ticket_messages || [])
      .filter(m => m.sender_type !== 'system')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return msgs[0]?.body?.substring(0, 100) || null
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Onsite Jobs</h2>
          <p className="text-sm text-slate-500">{filtered.length} jobs</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-gray-50 md:hidden"
        >
          Filters
        </button>
      </div>

      {/* Filters */}
      <div className={`mb-4 flex flex-wrap gap-3 ${showFilters ? '' : 'hidden md:flex'}`}>
        <select
          value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_customer">Waiting on Customer</option>
          <option value="resolved">Resolved</option>
        </select>
        <button
          onClick={() => setMyOnly(!myOnly)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            myOnly ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-slate-600 hover:bg-gray-50'
          }`}
        >
          My Jobs Only
        </button>
      </div>

      {/* Grouped Cards */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-slate-400">
          No onsite jobs found
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cid, { name, jobs }]) => (
            <div key={cid}>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">{name}</h3>
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map(job => {
                  const statusCfg = TICKET_STATUS_CONFIG[job.status]
                  const priorityCfg = TICKET_PRIORITY_CONFIG[job.priority]
                  const isOverdue = job.scheduled_date && job.scheduled_date < today
                  const isToday = job.scheduled_date === today
                  const lastMsg = getLatestMessage(job)

                  return (
                    <div key={job.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400">{job.ticket_number}</span>
                            {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900 truncate">{job.subject}</h4>
                        </div>
                        {priorityCfg ? (
                          <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} className="ml-2 shrink-0" />
                        ) : null}
                      </div>

                      <div className="space-y-1 mb-3">
                        {job.site_location ? (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-400">Site:</span> {job.site_location}
                            {job.room_number ? ` · Room ${job.room_number}` : ''}
                          </div>
                        ) : null}
                        {job.device_description ? (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-400">Device:</span> {job.device_description}
                          </div>
                        ) : null}
                        {job.scheduled_date ? (
                          <div className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isToday ? 'text-indigo-600' : 'text-slate-600'}`}>
                            {isOverdue ? 'OVERDUE: ' : isToday ? 'TODAY: ' : ''}
                            {new Date(job.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">No date scheduled</div>
                        )}
                        {job.contacts ? (
                          <div className="text-xs text-slate-500">Contact: {job.contacts.first_name} {job.contacts.last_name}</div>
                        ) : null}
                      </div>

                      {lastMsg ? (
                        <div className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-slate-500 line-clamp-2">
                          {lastMsg}...
                        </div>
                      ) : null}

                      {/* Card Actions */}
                      <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                        <select
                          value=""
                          onChange={e => { if (e.target.value) handleStatusChange(job.id, e.target.value) }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-slate-600 min-h-[32px]"
                        >
                          <option value="">Update Status</option>
                          {['open', 'in_progress', 'waiting_on_customer', 'resolved'].filter(s => s !== job.status).map(s => (
                            <option key={s} value={s}>{TICKET_STATUS_CONFIG[s]?.label || s}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setNoteJobId(job.id); setNoteText('') }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-slate-600 hover:bg-gray-50 min-h-[32px]"
                        >
                          Add Note
                        </button>
                        <button
                          onClick={() => { setTimeJobId(job.id); setTimeMinutes(''); setTimeDesc('') }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-slate-600 hover:bg-gray-50 min-h-[32px]"
                        >
                          Log Time
                        </button>
                        <Link
                          href={`/helpdesk/tickets/${job.id}`}
                          className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 no-underline min-h-[32px] flex items-center"
                        >
                          View Full
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {noteJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Internal Note</h3>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              placeholder="Enter your note..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNoteJobId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Time Modal */}
      {timeJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Log Time</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Minutes</label>
                <input
                  type="number"
                  value={timeMinutes}
                  onChange={e => setTimeMinutes(e.target.value)}
                  min="1"
                  placeholder="e.g. 30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  value={timeDesc}
                  onChange={e => setTimeDesc(e.target.value)}
                  placeholder="What was done?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setTimeJobId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleLogTime}
                disabled={!timeMinutes}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Log Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
