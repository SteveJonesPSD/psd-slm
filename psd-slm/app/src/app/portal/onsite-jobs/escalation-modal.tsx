'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createEscalationAction } from './portal-actions'

interface EscalationModalProps {
  onClose: () => void
  hasOnsiteContract: boolean
}

export function EscalationModal({ onClose, hasOnsiteContract }: EscalationModalProps) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)

    const result = await createEscalationAction(description)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(result.refNumber || 'Request submitted')
    setLoading(false)
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Urgent Request Submitted</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Reference: <strong className="text-slate-900 dark:text-white">{success}</strong></p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Our team has been notified and will contact you shortly.</p>
          <div className="mt-6">
            <Button size="sm" variant="primary" onClick={() => { onClose(); router.refresh() }}>Close</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-amber-500 p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Request Urgent Onsite Assistance</h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Use this if you have an urgent IT issue that cannot wait for your next scheduled visit. Our team will contact you to arrange the earliest possible attendance.
          </p>

          {!hasOnsiteContract && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                <strong>Please note:</strong> Urgent onsite visits are not included in your current support contract and will be arranged as a chargeable call-out. Our team will confirm costs before proceeding.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 mb-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Describe the urgent issue <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Describe what's happening and why it's urgent..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <Button size="sm" variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={handleSubmit} disabled={loading || !description.trim()}>
              Send Urgent Request
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
