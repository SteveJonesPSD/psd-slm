'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'
import { changeJobStatus, addJobNote, getJobPhotoUrl, getJobSignatureUrl, validateJob, toggleJobTask, getJobGpsLog } from '../../actions'
import type { JobGpsLog, GpsEventType } from '@/types/database'
import { CollectionSection } from './collection-section'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JobDetail({ job, canEdit }: { job: any; canEdit: boolean }) {
  const router = useRouter()
  const tasks = job.tasks || []
  const hasTasks = tasks.length > 0
  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'notes' | 'photos' | 'history' | 'location' | 'collection'>('details')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [validationNotes, setValidationNotes] = useState('')
  const [validating, setValidating] = useState(false)

  const statusConfig = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: '#6b7280', bg: '#f3f4f6' }
  const priorityConfig = JOB_PRIORITY_CONFIG[job.priority] || { label: job.priority, color: '#6b7280', bg: '#f3f4f6' }

  const jobType = job.job_type
  const company = job.company
  const contact = job.contact
  const engineer = job.engineer

  // Build site address string
  const addressParts = [job.site_address_line1, job.site_address_line2, job.site_city, job.site_county, job.site_postcode].filter(Boolean)
  const fullAddress = addressParts.join(', ')
  const mapsUrl = fullAddress ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}` : null

  // Format time
  const timeStr = job.scheduled_time ? job.scheduled_time.substring(0, 5) : null
  const durationHrs = Math.floor(job.estimated_duration_minutes / 60)
  const durationMins = job.estimated_duration_minutes % 60
  const durationStr = durationHrs > 0
    ? `${durationHrs}h${durationMins > 0 ? ` ${durationMins}m` : ''}`
    : `${durationMins}m`

  async function handleStatusChange(newStatus: string) {
    if (newStatus === 'cancelled') {
      setShowCancelModal(true)
      return
    }
    const result = await changeJobStatus(job.id, newStatus as 'scheduled' | 'travelling' | 'on_site' | 'completed' | 'unscheduled')
    if (!result.error) router.refresh()
  }

  async function handleCancel() {
    const result = await changeJobStatus(job.id, 'cancelled', { cancel_reason: cancelReason })
    if (!result.error) {
      setShowCancelModal(false)
      router.refresh()
    }
  }

  async function handleValidate() {
    setValidating(true)
    const result = await validateJob(job.id, validationNotes || undefined)
    if (!result.error) {
      setShowValidateModal(false)
      setValidationNotes('')
      router.refresh()
    }
    setValidating(false)
  }

  async function handleAddNote() {
    if (!note.trim()) return
    setSavingNote(true)
    const result = await addJobNote(job.id, note)
    if (!result.error) {
      setNote('')
      router.refresh()
    }
    setSavingNote(false)
  }

  // Status timeline steps
  const statusSteps = [
    { key: 'created', label: 'Created', time: job.created_at },
    { key: 'scheduled', label: 'Scheduled', time: job.status !== 'unscheduled' ? job.updated_at : null },
    { key: 'travelling', label: 'Travelling', time: job.travel_started_at },
    { key: 'on_site', label: 'On Site', time: job.arrived_at },
    { key: 'completed', label: 'Completed', time: job.completed_at },
    { key: 'validated', label: 'Validated', time: job.validated_at },
  ]

  const statusToStep: Record<string, number> = {
    unscheduled: 0,
    scheduled: 1,
    travelling: 2,
    on_site: 3,
    completed: 4,
    cancelled: -1,
  }
  let currentStepIndex = statusToStep[job.status as string] ?? 0
  if (job.validated_at) currentStepIndex = 5

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{job.job_number}</h1>
            <Badge {...statusConfig} />
            <Badge {...priorityConfig} />
            {jobType && (
              <Badge label={jobType.name} color={jobType.color} bg={jobType.background} />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{job.title}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link
              href={`/scheduling/jobs/${job.id}/edit`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-gray-50 no-underline"
            >
              Edit Job
            </Link>
            {/* Status action buttons */}
            {job.status === 'unscheduled' && (
              <Link
                href={`/scheduling/jobs/${job.id}/edit`}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
              >
                Assign & Schedule
              </Link>
            )}
            {job.status === 'scheduled' && (
              <>
                <button onClick={() => handleStatusChange('cancelled')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                  Cancel Job
                </button>
              </>
            )}
            {(job.status === 'travelling' || job.status === 'on_site') && (
              <button onClick={() => handleStatusChange('cancelled')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                Cancel Job
              </button>
            )}
            {job.status === 'completed' && !job.validated_at && (
              <button
                onClick={() => setShowValidateModal(true)}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Validate
              </button>
            )}
            {job.status === 'completed' && job.validated_at && (
              <a
                href={`/api/jobs/${job.id}/report`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
              >
                Download Report
              </a>
            )}
            {job.status === 'completed' && (
              <button onClick={() => handleStatusChange('scheduled')} className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
                Reopen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Customer */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Customer</h4>
          {company && (
            <div className="space-y-1 text-sm">
              <Link href={`/customers/${company.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                {company.name}
              </Link>
              {contact && (
                <p className="text-slate-600">{contact.first_name} {contact.last_name}</p>
              )}
              {(contact?.phone || contact?.mobile) && (
                <a href={`tel:${contact.mobile || contact.phone}`} className="block text-indigo-600">
                  {contact.mobile || contact.phone}
                </a>
              )}
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="block text-sm text-slate-500">
                  {contact.email}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Site */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Site</h4>
          <div className="text-sm text-slate-700">
            {fullAddress ? (
              mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                  {addressParts.map((p, i) => (
                    <span key={i}>{p}{i < addressParts.length - 1 && <br />}</span>
                  ))}
                </a>
              ) : (
                addressParts.map((p, i) => <div key={i}>{p}</div>)
              )
            ) : (
              <span className="text-slate-400">No address</span>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Schedule</h4>
          <div className="space-y-1 text-sm">
            {job.scheduled_date ? (
              <p className="font-medium text-slate-900">
                {new Date(job.scheduled_date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            ) : (
              <p className="text-slate-400">Unscheduled</p>
            )}
            {timeStr && <p className="text-slate-600">{timeStr}</p>}
            <p className="text-slate-600">{durationStr}</p>
            {/* Actual times */}
            {job.travel_started_at && (
              <p className="text-xs text-amber-600">
                Started {new Date(job.travel_started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {job.arrived_at && (
              <p className="text-xs text-purple-600">
                Arrived {new Date(job.arrived_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {job.completed_at && (
              <p className="text-xs text-green-600">
                Completed {new Date(job.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {engineer && (
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: engineer.color || '#6366f1' }}
                >
                  {engineer.initials || (engineer.first_name[0] + engineer.last_name[0])}
                </div>
                <span className="text-slate-700">{engineer.first_name} {engineer.last_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Source</h4>
          <p className="text-sm text-slate-600">Manual</p>
        </div>
      </div>

      {/* Status Timeline */}
      {job.status !== 'cancelled' && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => (
              <div key={step.key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div className={`h-0.5 flex-1 ${i <= currentStepIndex ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                  )}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      i <= currentStepIndex
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    } ${i === currentStepIndex ? 'ring-2 ring-indigo-300' : ''}`}
                  >
                    {i + 1}
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`h-0.5 flex-1 ${i < currentStepIndex ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                  )}
                </div>
                <span className={`mt-1 text-[10px] ${i <= currentStepIndex ? 'font-semibold text-indigo-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                {step.time && i <= currentStepIndex && (
                  <span className="text-[9px] text-slate-400">
                    {new Date(step.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {job.status === 'cancelled' && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Job Cancelled</p>
          {job.cancel_reason && <p className="mt-1 text-sm text-red-600">{job.cancel_reason}</p>}
          {job.cancelled_at && (
            <p className="mt-1 text-xs text-red-500">
              {new Date(job.cancelled_at).toLocaleString('en-GB')}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(['details', ...(hasTasks ? ['tasks'] as const : []), 'notes', 'photos', 'history', 'location', 'collection'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {tab === 'tasks' && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold">
                {tasks.filter((t: { is_completed: boolean }) => t.is_completed).length}/{tasks.length}
              </span>
            )}
            {tab === 'notes' && job.notes?.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold">{job.notes.length}</span>
            )}
            {tab === 'photos' && job.photos?.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold">{job.photos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {activeTab === 'details' && (
          <div className="space-y-4">
            {job.description && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Description</h4>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
              </div>
            )}
            {job.internal_notes && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Internal Notes</h4>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{job.internal_notes}</p>
              </div>
            )}
            {job.completion_notes && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Completion Notes</h4>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{job.completion_notes}</p>
              </div>
            )}
            {job.follow_up_required && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-700">
                Follow-up required
              </div>
            )}
            {job.validated_at && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase text-blue-600">Validated</h4>
                <p className="text-sm text-blue-800">
                  {new Date(job.validated_at).toLocaleString('en-GB')}
                  {job.validated_by_user && (
                    <span> by {(job.validated_by_user as { first_name: string; last_name: string }).first_name} {(job.validated_by_user as { first_name: string; last_name: string }).last_name}</span>
                  )}
                </p>
                {job.validation_notes && (
                  <p className="mt-1 text-sm text-blue-700">{job.validation_notes}</p>
                )}
              </div>
            )}
            {/* Signatures */}
            {(job.engineer_signature_path || job.customer_signature_path || job.customer_not_present) && (
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase text-slate-500">Signatures</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {job.engineer_signature_path && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Engineer</p>
                      <p className="mb-2 text-sm font-medium text-slate-900">{job.engineer_signature_name}</p>
                      <SignatureImage storagePath={job.engineer_signature_path} alt="Engineer signature" />
                    </div>
                  )}
                  {job.customer_not_present ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Customer</p>
                      <p className="text-sm text-amber-700">Customer not present</p>
                    </div>
                  ) : job.customer_signature_path ? (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Customer</p>
                      <p className="mb-2 text-sm font-medium text-slate-900">{job.customer_signature_name}</p>
                      <SignatureImage storagePath={job.customer_signature_path} alt="Customer signature" />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {!job.description && !job.internal_notes && !job.completion_notes && !job.validated_at && !job.engineer_signature_path && (
              <p className="text-sm text-slate-400">No additional details</p>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <TasksPanel tasks={tasks} canEdit={canEdit} onRefresh={() => router.refresh()} />
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            {(job.notes || []).map((n: { id: string; note: string; created_at: string; user: { first_name: string; last_name: string; initials: string; color: string } }) => (
              <div key={n.id} className="flex gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: n.user?.color || '#6366f1' }}
                >
                  {n.user?.initials || '??'}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {n.user?.first_name} {n.user?.last_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(n.created_at).toLocaleString('en-GB')}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.note}</p>
                </div>
              </div>
            ))}

            {canEdit && (
              <div className="border-t border-gray-100 pt-4">
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
                  className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            )}

            {(job.notes || []).length === 0 && !canEdit && (
              <p className="text-sm text-slate-400">No notes yet</p>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div>
            {(job.photos || []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(job.photos || []).map((photo: { id: string; storage_path: string; file_name: string; caption: string | null; created_at: string }) => (
                  <PhotoThumbnail key={photo.id} photo={photo} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No photos uploaded</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {(job.company_history || []).length > 0 ? (
              <div className="space-y-3">
                {(job.company_history || []).map((h: { id: string; job_number: string; title: string; job_type_name: string; job_type_color: string; job_type_background: string; scheduled_date: string | null; engineer_first_name: string | null; engineer_last_name: string | null; completion_notes: string | null }) => (
                  <Link
                    key={h.id}
                    href={`/scheduling/jobs/${h.id}`}
                    className="block rounded-lg border border-gray-100 p-3 hover:bg-gray-50 no-underline"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{h.job_number}</span>
                      <Badge label={h.job_type_name} color={h.job_type_color} bg={h.job_type_background} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{h.title}</p>
                    <div className="mt-1 flex gap-3 text-xs text-slate-400">
                      {h.scheduled_date && (
                        <span>{new Date(h.scheduled_date + 'T00:00').toLocaleDateString('en-GB')}</span>
                      )}
                      {h.engineer_first_name && (
                        <span>{h.engineer_first_name} {h.engineer_last_name}</span>
                      )}
                    </div>
                    {h.completion_notes && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{h.completion_notes}</p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No previous jobs at this company</p>
            )}
          </div>
        )}

        {activeTab === 'location' && (
          <GpsLogPanel jobId={job.id} />
        )}

        {activeTab === 'collection' && (
          <CollectionSection
            jobId={job.id}
            salesOrderId={job.sales_order_id || null}
            canCreate={canEdit}
          />
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel Job</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to cancel this job?</p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-gray-50"
              >
                Keep Job
              </button>
              <button
                onClick={handleCancel}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Cancel Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validate Modal */}
      {showValidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Validate Job</h3>
            <p className="mt-2 text-sm text-slate-600">
              Confirm this job has been completed to standard. Once validated, a report can be generated and sent to the customer.
            </p>
            <textarea
              value={validationNotes}
              onChange={e => setValidationNotes(e.target.value)}
              placeholder="Validation notes (optional)..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowValidateModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleValidate}
                disabled={validating}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {validating ? 'Validating...' : 'Validate Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SignatureImage({ storagePath, alt }: { storagePath: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getJobSignatureUrl(storagePath).then(setUrl)
  }, [storagePath])

  return (
    <div className="h-20 rounded border border-gray-100 bg-white">
      {url ? (
        <img
          src={url}
          alt={alt}
          className={`h-full w-auto object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading...</div>
      )}
    </div>
  )
}

function TasksPanel({ tasks, canEdit, onRefresh }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[]
  canEdit: boolean
  onRefresh: () => void
}) {
  const requiredTasks = tasks.filter(t => t.is_required)
  const completedRequired = requiredTasks.filter(t => t.is_completed).length
  const allCompleted = tasks.every(t => t.is_completed)
  const completedCount = tasks.filter(t => t.is_completed).length

  async function handleToggle(taskId: string) {
    await toggleJobTask(taskId)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          {completedCount}/{tasks.length} completed
          {requiredTasks.length > 0 && ` (${completedRequired}/${requiredTasks.length} required)`}
        </span>
        {allCompleted && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            All complete
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${allCompleted ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
        />
      </div>

      {/* Task list */}
      <div className="divide-y divide-slate-100">
        {tasks.map((task: { id: string; description: string; is_required: boolean; is_completed: boolean; completed_at: string | null; completed_by_user: { first_name: string; last_name: string } | null; notes: string | null; response_type: string; response_value: string | null }) => (
          <div key={task.id} className="flex items-start gap-3 py-3">
            {canEdit && task.response_type === 'yes_no' ? (
              <button
                onClick={() => handleToggle(task.id)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  task.is_completed
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-slate-300 bg-white hover:border-indigo-400'
                }`}
              >
                {task.is_completed && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ) : (
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                task.is_completed ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {task.is_completed && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${task.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {task.description}
                </span>
                {task.is_required && !task.is_completed && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    Required
                  </span>
                )}
                {task.response_type !== 'yes_no' && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {task.response_type === 'text' ? 'Text' : 'Date'}
                  </span>
                )}
              </div>
              {task.response_value && (
                <p className="mt-0.5 text-xs text-indigo-600">
                  {task.response_type === 'date'
                    ? new Date(task.response_value + 'T00:00').toLocaleDateString('en-GB')
                    : task.response_value}
                </p>
              )}
              {task.is_completed && task.completed_at && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(task.completed_at).toLocaleString('en-GB')}
                  {task.completed_by_user && (
                    <span> by {task.completed_by_user.first_name} {task.completed_by_user.last_name}</span>
                  )}
                </p>
              )}
              {task.notes && (
                <p className="mt-0.5 text-xs text-slate-500">{task.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const GPS_EVENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  travel_started: { label: 'Travel Started', color: '#d97706', bg: '#fffbeb' },
  arrived: { label: 'Arrived', color: '#7c3aed', bg: '#f5f3ff' },
  completed: { label: 'Completed', color: '#059669', bg: '#ecfdf5' },
  note_added: { label: 'Note Added', color: '#2563eb', bg: '#eff6ff' },
  task_toggled: { label: 'Task Toggled', color: '#6366f1', bg: '#eef2ff' },
  photo_added: { label: 'Photo Added', color: '#0891b2', bg: '#ecfeff' },
  status_changed: { label: 'Status Changed', color: '#6b7280', bg: '#f9fafb' },
}

function GpsLogPanel({ jobId }: { jobId: string }) {
  const [entries, setEntries] = useState<JobGpsLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJobGpsLog(jobId).then(result => {
      setEntries(result.data || [])
      setLoading(false)
    })
  }, [jobId])

  if (loading) {
    return <p className="text-sm text-slate-400">Loading location log...</p>
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-slate-400">No GPS data captured for this job</p>
        <p className="text-xs text-slate-300 mt-1">GPS coordinates are recorded when engineers interact with jobs on mobile devices</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{entries.length} location event{entries.length !== 1 ? 's' : ''} captured</p>

      {/* Map */}
      <GpsMap entries={entries} />

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(GPS_EVENT_LABELS).map(([key, cfg]) => {
          if (!entries.some(e => e.event_type === key)) return null
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-[11px] text-slate-600">{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-4">
          {entries.map((entry) => {
            const cfg = GPS_EVENT_LABELS[entry.event_type] || GPS_EVENT_LABELS.status_changed
            const accuracy = entry.accuracy_metres
            const accColor = accuracy == null ? 'text-slate-400' : accuracy < 20 ? 'text-green-600' : accuracy < 100 ? 'text-amber-600' : 'text-red-600'
            const user = entry.user as { first_name: string; last_name: string } | undefined
            const mapsUrl = `https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`

            return (
              <div key={entry.id} className="relative flex items-start gap-3 pl-8">
                <div
                  className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white"
                  style={{ backgroundColor: cfg.color }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    <span className="text-xs text-slate-400">
                      {new Date(entry.captured_at).toLocaleString('en-GB')}
                    </span>
                    {user && (
                      <span className="text-xs text-slate-500">{user.first_name} {user.last_name}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                    </a>
                    {accuracy != null && (
                      <span className={accColor}>
                        {accuracy < 1000 ? `${Math.round(accuracy)}m` : `${(accuracy / 1000).toFixed(1)}km`} accuracy
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GpsMap({ entries }: { entries: JobGpsLog[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapReady, setMapReady] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMap = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || entries.length === 0) return

    let cancelled = false

    async function initMap() {
      // Dynamic import — keeps Leaflet out of the SSR bundle
      const L = (await import('leaflet')).default
      // @ts-expect-error — CSS import handled by bundler at runtime
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current) return

      // Clean up previous map instance if any
      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }

      // Calculate bounds
      const lats = entries.map(e => e.latitude)
      const lngs = entries.map(e => e.longitude)
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      )

      const map = L.map(mapRef.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Fit bounds with padding, or centre on single point
      if (entries.length === 1) {
        map.setView([entries[0].latitude, entries[0].longitude], 16)
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
      }

      // Add markers with colour-coded circle icons
      entries.forEach((entry, idx) => {
        const cfg = GPS_EVENT_LABELS[entry.event_type] || GPS_EVENT_LABELS.status_changed
        const user = entry.user as { first_name: string; last_name: string } | undefined
        const time = new Date(entry.captured_at).toLocaleString('en-GB')

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: 22px; height: 22px; border-radius: 50%;
            background: ${cfg.color}; border: 3px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 10px; font-weight: 700;
          ">${idx + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        })

        const tooltipContent = [
          `<strong>${cfg.label}</strong>`,
          time,
          user ? `${user.first_name} ${user.last_name}` : null,
          entry.accuracy_metres != null ? `${Math.round(entry.accuracy_metres)}m accuracy` : null,
        ].filter(Boolean).join('<br/>')

        L.marker([entry.latitude, entry.longitude], { icon })
          .addTo(map)
          .bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -14],
            className: 'gps-map-tooltip',
          })
      })

      // Draw path line connecting events in order
      if (entries.length > 1) {
        const coords = entries.map(e => [e.latitude, e.longitude] as [number, number])
        L.polyline(coords, {
          color: '#6366f1',
          weight: 2,
          opacity: 0.5,
          dashArray: '6 4',
        }).addTo(map)
      }

      leafletMap.current = map
      setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }
    }
  }, [entries])

  return (
    <>
      <style>{`
        .gps-map-tooltip {
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          padding: 6px 10px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
      `}</style>
      <div
        ref={mapRef}
        className="h-72 w-full rounded-lg border border-gray-200 bg-gray-50"
        style={{ zIndex: 0 }}
      />
    </>
  )
}

function PhotoThumbnail({ photo }: { photo: { id: string; storage_path: string; file_name: string; caption: string | null; created_at: string } }) {
  const [url, setUrl] = useState<string | null>(null)

  async function loadUrl() {
    if (url) return
    const signedUrl = await getJobPhotoUrl(photo.storage_path)
    setUrl(signedUrl)
  }

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
      onMouseEnter={loadUrl}
      onClick={loadUrl}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption || photo.file_name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-xs text-white">
          {photo.caption}
        </div>
      )}
    </div>
  )
}
