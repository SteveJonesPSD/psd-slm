'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { updatePoStatus } from '../actions'
import { SendPoModal } from './send-po-modal'

interface PoDetailActionsProps {
  poId: string
  status: string
  poNumber?: string
  supplierName?: string
  supplierEmail?: string | null
  purchaseType?: string
}

export function PoDetailActions({ poId, status, poNumber, supplierName, supplierEmail, purchaseType }: PoDetailActionsProps) {
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
        <Link href={`/api/purchase-orders/${poId}/pdf`} target="_blank">
          <Button size="sm">Download PDF</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={`/api/purchase-orders/${poId}/pdf`} target="_blank">
          <Button size="sm">Download PDF</Button>
        </Link>
        {status === 'draft' && (
          <>
            {purchaseType === 'stock_order' && (
              <Button
                size="sm"
                variant="success"
                onClick={async () => {
                  setLoading('save')
                  const result = await updatePoStatus(poId, 'sent')
                  setLoading(null)
                  if ('error' in result && result.error) {
                    alert(result.error)
                  } else {
                    router.refresh()
                  }
                }}
                disabled={loading === 'save'}
              >
                {loading === 'save' ? 'Saving...' : 'Save PO'}
              </Button>
            )}
            <Button
              size="sm"
              variant="success"
              onClick={() => handleAction('sent')}
              disabled={loading === 'sent'}
            >
              {loading === 'sent' ? 'Sending...' : 'Send to Supplier'}
            </Button>
          </>
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
        <SendPoModal
          po={{
            id: poId,
            po_number: poNumber || '',
            supplier_name: supplierName || 'Supplier',
            supplier_email: supplierEmail || null,
          }}
          onClose={() => setShowSendModal(false)}
        />
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
