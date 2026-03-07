'use client'

import { useState, useRef, useEffect, useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeJob, toggleJobTask } from '../../../actions'
import { SignaturePadComponent } from '@/components/ui/signature-pad'
import { useGeoCapture } from '@/lib/use-geo-capture'
import type { GpsCoords } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SchedulingCompletionForm({ job, currentUserName }: { job: any; currentUserName?: string }) {
  const router = useRouter()
  const { capturePosition } = useGeoCapture()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Capture GPS on mount
  const [gps, setGps] = useState<GpsCoords | null>(null)
  useEffect(() => {
    capturePosition().then(setGps)
  }, [capturePosition])

  // Task state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: any[] = job.tasks || []
  const [taskResponses, setTaskResponses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const t of tasks) {
      if (t.response_value) init[t.id] = t.response_value
    }
    return init
  })
  const [optimisticTasks, setOptimisticTask] = useOptimistic(
    tasks,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any[], update: { id: string; is_completed: boolean; response_value?: string }) =>
      state.map(t => t.id === update.id ? { ...t, is_completed: update.is_completed, response_value: update.response_value ?? t.response_value } : t)
  )
  const [, startTransition] = useTransition()

  const requiredTasks = optimisticTasks.filter((t: { is_required: boolean }) => t.is_required)
  const completedRequired = requiredTasks.filter((t: { is_completed: boolean }) => t.is_completed).length
  const allRequiredDone = requiredTasks.length === 0 || completedRequired === requiredTasks.length

  async function handleToggleTask(taskId: string) {
    startTransition(() => {
      setOptimisticTask({ id: taskId, is_completed: !optimisticTasks.find(t => t.id === taskId)?.is_completed })
    })
    const taskGps = await capturePosition()
    await toggleJobTask(taskId, { gps: taskGps })
  }

  async function handleTaskResponse(taskId: string, value: string) {
    setTaskResponses(prev => ({ ...prev, [taskId]: value }))
    const hasValue = value.trim().length > 0
    startTransition(() => {
      setOptimisticTask({ id: taskId, is_completed: hasValue, response_value: value })
    })
    const taskGps = await capturePosition()
    await toggleJobTask(taskId, { response_value: value || '', gps: taskGps })
  }

  // Signature state
  const [engineerSignature, setEngineerSignature] = useState<string | null>(null)
  const [engineerName, setEngineerName] = useState(currentUserName || '')
  const [customerNotPresent, setCustomerNotPresent] = useState(false)
  const [customerSignature, setCustomerSignature] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allRequiredDone) {
      setError('Complete all required tasks before submitting')
      return
    }
    if (!completionNotes.trim()) {
      setError('Completion notes are required')
      return
    }
    if (!engineerSignature) {
      setError('Engineer signature is required')
      return
    }
    if (!engineerName.trim()) {
      setError('Engineer name is required')
      return
    }
    if (!customerNotPresent && !customerSignature) {
      setError('Customer signature is required (or mark customer not present)')
      return
    }
    if (!customerNotPresent && !customerName.trim()) {
      setError('Customer name is required')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      // Re-capture GPS at submission time for freshest coords
      const submitGps = await capturePosition()
      const finalGps = submitGps || gps

      const formData = new FormData()
      formData.set('completion_notes', completionNotes)
      formData.set('follow_up_required', String(followUpRequired))

      // GPS coordinates
      if (finalGps) {
        formData.set('gps_latitude', String(finalGps.latitude))
        formData.set('gps_longitude', String(finalGps.longitude))
        if (finalGps.accuracy !== null) {
          formData.set('gps_accuracy', String(finalGps.accuracy))
        }
      }

      // Signature data
      formData.set('engineer_signature', engineerSignature)
      formData.set('engineer_name', engineerName.trim())
      formData.set('customer_not_present', String(customerNotPresent))
      if (!customerNotPresent && customerSignature) {
        formData.set('customer_signature', customerSignature)
        formData.set('customer_name', customerName.trim())
      }

      for (const file of selectedFiles) {
        formData.append('photos', file)
      }

      const result = await completeJob(job.id, formData)

      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/scheduling/jobs/${job.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link href={`/scheduling/jobs/${job.id}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to job
      </Link>

      <h1 className="mb-1 text-xl font-bold text-slate-900">Complete Job</h1>
      <p className="mb-6 text-sm text-slate-500">{job.job_number} — {job.company?.name}</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Task Checklist */}
        {optimisticTasks.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Task Checklist</h3>
              {requiredTasks.length > 0 && (
                <span className={`text-xs font-medium ${allRequiredDone ? 'text-green-600' : 'text-amber-600'}`}>
                  {completedRequired}/{requiredTasks.length} required
                </span>
              )}
            </div>
            {/* Progress bar */}
            {requiredTasks.length > 0 && (
              <div className="mb-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allRequiredDone ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${(completedRequired / requiredTasks.length) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-2">
              {optimisticTasks.map((task: { id: string; description: string; is_required: boolean; is_completed: boolean; response_type: string; response_value: string | null }) => (
                <div key={task.id} className="p-2 rounded-lg">
                  {task.response_type === 'yes_no' ? (
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="flex items-start gap-3 w-full text-left hover:bg-slate-50 transition-colors rounded-lg p-1"
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
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${task.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {task.description}
                        </span>
                        {task.is_required && !task.is_completed && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Required
                          </span>
                        )}
                      </div>
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
                          placeholder="Enter response..."
                          className="ml-7 w-[calc(100%-1.75rem)] rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <input
                          type="date"
                          value={taskResponses[task.id] || ''}
                          onChange={e => handleTaskResponse(task.id, e.target.value)}
                          className="ml-7 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!allRequiredDone && (
              <p className="mt-3 text-xs text-amber-600">
                Complete all required tasks before submitting
              </p>
            )}
          </div>
        )}

        {/* Completion Notes */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Completion Notes *
          </label>
          <textarea
            value={completionNotes}
            onChange={e => setCompletionNotes(e.target.value)}
            placeholder="What was done? Any issues or follow-up needed?"
            rows={5}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Photos</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-2 h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-slate-500">Tap to take or select photos</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFilesChange}
            className="hidden"
          />

          {selectedFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {selectedFiles.map((file, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-sm"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engineer Signature */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Engineer Signature *
          </label>
          <div className="mb-2">
            <input
              type="text"
              value={engineerName}
              onChange={e => setEngineerName(e.target.value)}
              placeholder="Engineer full name"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <SignaturePadComponent
            onSignatureChange={setEngineerSignature}
            label="Engineer signature"
          />
        </div>

        {/* Customer Not Present Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Customer not present</p>
            <p className="text-xs text-slate-400">Skip customer signature if no one is on site</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCustomerNotPresent(!customerNotPresent)
              if (!customerNotPresent) {
                setCustomerSignature(null)
                setCustomerName('')
              }
            }}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              customerNotPresent ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                customerNotPresent ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Customer Signature */}
        {!customerNotPresent && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Customer Signature *
            </label>
            <div className="mb-2">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <SignaturePadComponent
              onSignatureChange={setCustomerSignature}
              label="Customer signature"
            />
          </div>
        )}

        {/* Follow-up toggle */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Job completed successfully?</p>
            <p className="text-xs text-slate-400">Toggle off if follow-up is needed</p>
          </div>
          <button
            type="button"
            onClick={() => setFollowUpRequired(!followUpRequired)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              followUpRequired ? 'bg-amber-500' : 'bg-green-500'
            }`}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                followUpRequired ? 'left-0.5' : 'left-5'
              }`}
            />
          </button>
        </div>
        {followUpRequired && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            This job will be flagged for follow-up
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={`/scheduling/jobs/${job.id}`}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-medium text-slate-700 no-underline hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !completionNotes.trim() || !allRequiredDone}
            className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Completing...' : 'Complete Job'}
          </button>
        </div>
      </form>
    </div>
  )
}
