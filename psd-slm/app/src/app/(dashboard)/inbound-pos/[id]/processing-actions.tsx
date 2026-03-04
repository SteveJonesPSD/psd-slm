'use client'

import { useState } from 'react'
import { updateInboundPO, rejectInboundPO, retryExtraction } from '../actions'

interface ProcessingActionsProps {
  inboundPoId: string
  status: string
  internalNotes: string | null
  matchedQuoteId: string | null
  onAction: () => void
}

export function ProcessingActions({
  inboundPoId,
  status,
  internalNotes,
  matchedQuoteId,
  onAction,
}: ProcessingActionsProps) {
  const [notes, setNotes] = useState(internalNotes || '')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const isActive = !['completed', 'rejected', 'uploading', 'extracting'].includes(status)

  const handleSaveNotes = async () => {
    setSaving(true)
    await updateInboundPO(inboundPoId, { internal_notes: notes || null })
    setSaving(false)
    onAction()
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setSaving(true)
    await rejectInboundPO(inboundPoId, rejectReason)
    setShowRejectModal(false)
    setSaving(false)
    onAction()
  }

  const handleRetry = async () => {
    setRetrying(true)
    await retryExtraction(inboundPoId)
    setRetrying(false)
    onAction()
  }

  if (status === 'uploading' || status === 'extracting') {
    return null
  }

  return (
    <>
      <div className="sticky bottom-0 z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-4">
          {/* Internal notes */}
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add internal notes about this PO..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-5">
            {isActive && (
              <div className="flex gap-2">
                {/* Save notes */}
                {notes !== (internalNotes || '') && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                )}

                {/* Create Sales Order — disabled placeholder */}
                <div className="relative group">
                  <button
                    disabled
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
                  >
                    Create Sales Order
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-lg">
                      Coming soon — requires Sales Orders module
                    </div>
                  </div>
                </div>

                {/* Reject */}
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={saving}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Reject PO
                </button>
              </div>
            )}

            {/* Retry extraction for error state */}
            {status === 'error' && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry Extraction'}
              </button>
            )}

            {/* Show status info for completed/rejected */}
            {status === 'rejected' && (
              <span className="text-xs text-red-500">This PO has been rejected.</span>
            )}
            {status === 'completed' && (
              <span className="text-xs text-green-600">This PO has been processed into a Sales Order.</span>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Reject Purchase Order</h3>
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Enter the reason for rejecting this PO..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-slate-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Rejecting...' : 'Reject PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
