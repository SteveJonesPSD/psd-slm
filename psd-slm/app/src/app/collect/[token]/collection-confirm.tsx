'use client'

import { useState, useCallback } from 'react'
import { useGeoCapture } from '@/lib/use-geo-capture'
import { SignaturePadComponent } from '@/components/ui/signature-pad'
import type { CollectionSlipPublic } from '@/lib/collections/types'

interface Props {
  collection: CollectionSlipPublic
  token: string
}

export function CollectionConfirm({ collection, token }: Props) {
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [engineerName, setEngineerName] = useState('')
  const [engineerInitials, setEngineerInitials] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gpsStatus, setGpsStatus] = useState<string | null>(null)
  const { captureWithReason } = useGeoCapture()

  const lines = collection.lines.sort((a, b) => a.sort_order - b.sort_order)
  const totalLines = lines.length
  const confirmedCount = confirmedIds.size
  const allConfirmed = confirmedCount === totalLines

  // Signature fields are all required
  const signatureComplete = !!(engineerName.trim() && engineerInitials.trim() && signatureDataUrl)

  const toggleLine = useCallback((lineId: string) => {
    setConfirmedIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      return next
    })
  }, [])

  const handleConfirm = async (isPartial: boolean) => {
    if (!signatureComplete) {
      setError('Please provide your name, initials, and signature before confirming.')
      return
    }

    setSubmitting(true)
    setError(null)

    // Capture GPS
    const { coords, error: gpsError } = await captureWithReason()
    if (coords) {
      setGpsStatus('Location captured')
    } else if (gpsError) {
      const messages: Record<string, string> = {
        permission_denied: 'Location permission denied',
        position_unavailable: 'Location unavailable',
        timeout: 'Location timed out',
        not_supported: 'Location not supported',
      }
      setGpsStatus(messages[gpsError] || 'Location unavailable')
    }

    const confirmedLines = lines
      .filter((l) => confirmedIds.has(l.id))
      .map((l) => ({
        lineId: l.id,
        quantityConfirmed: l.quantity_expected,
        confirmedSerials: l.expected_serials || undefined,
      }))

    try {
      const res = await fetch('/api/collect/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          confirmedLines,
          notes: notes.trim() || undefined,
          gps: coords ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          } : undefined,
          engineerSignature: signatureDataUrl,
          engineerName: engineerName.trim(),
          engineerInitials: engineerInitials.trim(),
        }),
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        setError(result.error || 'Failed to confirm collection.')
        setSubmitting(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Collection Confirmed</h2>
        <p className="text-sm text-slate-500 mb-1">{collection.slip_number}</p>
        <p className="text-xs text-slate-400 mb-1">
          Collected by <span className="font-medium text-slate-600">{engineerName.trim()}</span> ({engineerInitials.trim().toUpperCase()})
        </p>
        <p className="text-xs text-slate-400 mb-6">
          {new Date().toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {gpsStatus && (
          <p className="text-xs text-slate-400 mb-4">{gpsStatus}</p>
        )}
        <a
          href={`/field/job/${collection.job_id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          View Job
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
          Stock Collection
        </div>
        <div className="text-xl font-bold text-slate-900 mb-1">
          {collection.customer_name}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{collection.job_number}</span>
          <span>·</span>
          <span>{totalLines} item{totalLines !== 1 ? 's' : ''} to confirm</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-slate-600 font-medium">
            {confirmedCount} of {totalLines} items confirmed
          </span>
          <span className="text-slate-400">
            {totalLines > 0 ? Math.round((confirmedCount / totalLines) * 100) : 0}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${totalLines > 0 ? (confirmedCount / totalLines) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Item cards */}
      <div className="space-y-2 mb-6">
        {lines.map((line) => {
          const isConfirmed = confirmedIds.has(line.id)
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => toggleLine(line.id)}
              className={`w-full text-left rounded-xl border p-4 transition-all min-h-[60px] ${
                isConfirmed
                  ? 'bg-green-50 border-green-300 border-l-4 border-l-green-500'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Check circle */}
                <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${
                  isConfirmed ? 'bg-green-500 text-white' : 'border-2 border-slate-300'
                }`}>
                  {isConfirmed && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isConfirmed ? 'text-green-800' : 'text-slate-800'}`}>
                    {line.quantity_expected}× {line.description}
                  </div>
                  {line.expected_serials && line.expected_serials.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {line.expected_serials.map((sn, i) => (
                        <div key={i} className="text-xs font-mono text-slate-500">{sn}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Add a note (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Missing 1x patch lead, box 2 has damage…"
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
        />
      </div>

      {/* Engineer Details & Signature */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Engineer Confirmation</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={engineerName}
              onChange={(e) => setEngineerName(e.target.value)}
              placeholder="e.g. Dan Whittle"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Initials <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={engineerInitials}
              onChange={(e) => setEngineerInitials(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. DW"
              maxLength={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase placeholder:text-slate-400 placeholder:normal-case focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Signature <span className="text-red-500">*</span>
          </label>
          <SignaturePadComponent
            onSignatureChange={setSignatureDataUrl}
            label="Sign to confirm collection"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* GPS status */}
      {gpsStatus && (
        <div className="mb-4 text-xs text-slate-400 text-center">{gpsStatus}</div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {allConfirmed && (
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            disabled={submitting || !signatureComplete}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Confirming…' : 'Confirm Collection'}
          </button>
        )}

        {!allConfirmed && confirmedCount > 0 && notes.trim() && (
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            disabled={submitting || !signatureComplete}
            className="w-full rounded-xl bg-amber-500 px-4 py-4 text-base font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Confirming…' : `Confirm Partial Collection (${confirmedCount}/${totalLines})`}
          </button>
        )}

        {!allConfirmed && confirmedCount === 0 && (
          <div className="text-center text-sm text-slate-400 py-4">
            Tap each item to confirm you have it
          </div>
        )}

        {!allConfirmed && confirmedCount > 0 && !notes.trim() && (
          <div className="text-center text-sm text-amber-600 py-2">
            Add a note to confirm a partial collection
          </div>
        )}

        {confirmedCount > 0 && !signatureComplete && (
          <div className="text-center text-sm text-amber-600 py-1">
            Name, initials, and signature are required
          </div>
        )}
      </div>
    </div>
  )
}
