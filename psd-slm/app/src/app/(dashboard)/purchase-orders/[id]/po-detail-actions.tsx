'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { updatePoStatus } from '../actions'

interface PoDetailActionsProps {
  poId: string
  status: string
  poNumber?: string
  supplierName?: string
}

export function PoDetailActions({ poId, status, poNumber, supplierName }: PoDetailActionsProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const canEdit = hasPermission('purchase_orders', 'edit')
  const isTerminal = ['received', 'cancelled'].includes(status)

  const handleAction = async (action: 'sent' | 'acknowledged' | 'cancelled') => {
    if (action === 'cancelled') {
      setShowCancelModal(true)
      return
    }
    if (action === 'sent') {
      setShowSendModal(true)
      return
    }
    setLoading(action)
    const result = await updatePoStatus(poId, action)
    setLoading(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleConfirmSend = async () => {
    setLoading('sent')
    const result = await updatePoStatus(poId, 'sent')
    setLoading(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowSendModal(false)
      router.refresh()
    }
  }

  const handleCancel = async () => {
    setLoading('cancelled')
    const result = await updatePoStatus(poId, 'cancelled')
    setLoading(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowCancelModal(false)
      router.refresh()
    }
  }

  if (!canEdit || isTerminal) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/api/purchase-orders/${poId}/pdf`}
          target="_blank"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
        >
          Download PDF
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href={`/api/purchase-orders/${poId}/pdf`}
          target="_blank"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
        >
          Download PDF
        </Link>
        {status === 'draft' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleAction('sent')}
            disabled={loading === 'sent'}
          >
            {loading === 'sent' ? 'Sending...' : 'Send to Supplier'}
          </Button>
        )}
        {status === 'sent' && (
          <Button
            size="sm"
            variant="blue"
            onClick={() => handleAction('acknowledged')}
            disabled={loading === 'acknowledged'}
          >
            {loading === 'acknowledged' ? 'Updating...' : 'Mark Acknowledged'}
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleAction('cancelled')}
        >
          Cancel PO
        </Button>
      </div>

      {showSendModal && (
        <Modal title="Send to Supplier" onClose={() => setShowSendModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to send <strong>{poNumber || 'this PO'}</strong> to <strong>{supplierName || 'the supplier'}</strong>?
          </p>
          <p className="text-xs text-slate-400 mb-4">
            This will mark the PO as sent and update all line statuses to &ldquo;ordered&rdquo;.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowSendModal(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleConfirmSend} disabled={loading === 'sent'}>
              {loading === 'sent' ? 'Sending...' : 'Confirm & Send'}
            </Button>
          </div>
        </Modal>
      )}

      {showCancelModal && (
        <Modal title="Cancel Purchase Order" onClose={() => setShowCancelModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to cancel this purchase order?
            {['partially_received'].includes(status) && (
              <span className="block mt-2 text-amber-600 font-medium">
                Warning: Some goods have already been received on this PO.
              </span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowCancelModal(false)}>
              Keep PO
            </Button>
            <Button size="sm" variant="danger" onClick={handleCancel} disabled={loading === 'cancelled'}>
              {loading === 'cancelled' ? 'Cancelling...' : 'Cancel PO'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
