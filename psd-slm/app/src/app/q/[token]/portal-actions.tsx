'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SignaturePadComponent } from './signature-pad'

interface PortalActionsProps {
  quoteId: string
  token: string
}

export function PortalActions({ quoteId, token }: PortalActionsProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'accept' | 'changes' | 'decline'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Accept form state
  const [poNumber, setPoNumber] = useState('')
  const [poFile, setPoFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [signedByName, setSignedByName] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)

  // Change request form state
  const [crName, setCrName] = useState('')
  const [crType, setCrType] = useState('general')
  const [crMessage, setCrMessage] = useState('')

  // Decline form state
  const [declineReason, setDeclineReason] = useState('')
  const [confirmDecline, setConfirmDecline] = useState(false)

  const handleFileDrop = useCallback((file: File) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      setError('Please upload a PDF, Word document, or image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB')
      return
    }
    setPoFile(file)
    setError(null)
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileDrop(e.dataTransfer.files[0])
    }
  }, [handleFileDrop])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileDrop(e.target.files[0])
    }
  }, [handleFileDrop])

  const handleAccept = async () => {
    if (!signedByName.trim()) {
      setError('Your full name is required')
      return
    }
    if (!signatureData) {
      setError('Please provide your signature')
      return
    }
    if (!poNumber.trim()) {
      setError('Purchase order number is required')
      return
    }
    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.set('po_number', poNumber)
    formData.set('token', token)
    formData.set('signed_by_name', signedByName)
    formData.set('signature_data', signatureData)
    if (poFile) formData.set('po_file', poFile)

    const res = await fetch(`/api/quotes/${quoteId}/portal/accept`, {
      method: 'POST',
      body: formData,
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || 'Failed to accept quote')
    } else {
      router.refresh()
    }
  }

  const handleChangeRequest = async () => {
    if (!crName.trim() || !crMessage.trim()) {
      setError('Name and message are required')
      return
    }
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/quotes/${quoteId}/portal/change-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        requested_by: crName,
        request_type: crType,
        message: crMessage,
      }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || 'Failed to submit request')
    } else {
      setMode('idle')
      setCrName('')
      setCrType('general')
      setCrMessage('')
      alert('Your change request has been submitted. We will be in touch shortly.')
    }
  }

  const handleDecline = async () => {
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/quotes/${quoteId}/portal/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        reason: declineReason || null,
      }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || 'Failed to decline quote')
    } else {
      router.refresh()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Respond to this Quote</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {mode === 'idle' && (
        <div className="flex gap-3">
          <button
            onClick={() => setMode('accept')}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Accept Quote
          </button>
          <button
            onClick={() => setMode('changes')}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Request Changes
          </button>
          <button
            onClick={() => setMode('decline')}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {/* Accept Form */}
      {mode === 'accept' && (
        <div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Your Full Name *</label>
            <input
              type="text"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
              placeholder="Enter your full name..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Signature *</label>
            <SignaturePadComponent onSignatureChange={setSignatureData} />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Order Number *</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Enter your PO number..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* Drag & Drop PO Document Upload */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">PO Document (optional)</label>
            {poFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <svg className="h-8 w-8 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{poFile.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(poFile.size)}</p>
                </div>
                <button
                  onClick={() => { setPoFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="shrink-0 rounded-md p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <svg className={`h-8 w-8 mb-2 ${dragActive ? 'text-blue-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, PNG or JPEG (max 10MB)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Confirm Acceptance'}
            </button>
            <button
              onClick={() => { setMode('idle'); setError(null) }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Change Request Form */}
      {mode === 'changes' && (
        <div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Your Name *</label>
            <input
              type="text"
              value={crName}
              onChange={(e) => setCrName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Request Type</label>
            <select
              value={crType}
              onChange={(e) => setCrType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="general">General</option>
              <option value="pricing">Pricing</option>
              <option value="specification">Specification</option>
              <option value="quantity">Quantity</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Message *</label>
            <textarea
              value={crMessage}
              onChange={(e) => setCrMessage(e.target.value)}
              rows={4}
              placeholder="Please describe the changes you'd like..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleChangeRequest}
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              onClick={() => { setMode('idle'); setError(null) }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Decline Form */}
      {mode === 'decline' && (
        <div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Reason (optional)</label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder="Let us know why you're declining (optional)..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
            />
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={confirmDecline}
                onChange={(e) => setConfirmDecline(e.target.checked)}
                className="rounded border-slate-300"
              />
              I confirm I want to decline this quote
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDecline}
              disabled={submitting || !confirmDecline}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Decline Quote'}
            </button>
            <button
              onClick={() => { setMode('idle'); setError(null); setConfirmDecline(false) }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
