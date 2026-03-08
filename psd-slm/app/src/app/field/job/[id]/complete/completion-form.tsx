'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeJob } from '@/app/(dashboard)/scheduling/actions'
import { SignaturePadComponent } from '@/components/ui/signature-pad'
import { useGeoCapture } from '@/lib/use-geo-capture'
import type { GpsCoords } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CompletionForm({ job, currentUserName }: { job: any; currentUserName?: string }) {
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
        router.push(`/field/job/${job.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link href={`/field/job/${job.id}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to job
      </Link>

      <h1 className="mb-1 text-xl font-bold text-slate-900">Complete Job</h1>
      <p className="mb-6 text-sm text-slate-500">{job.job_number} — {job.company?.name}</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Photo Thumbnails */}
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
            href={`/field/job/${job.id}`}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-medium text-slate-700 no-underline hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !completionNotes.trim()}
            className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Completing...' : 'Complete Job'}
          </button>
        </div>
      </form>
    </div>
  )
}
