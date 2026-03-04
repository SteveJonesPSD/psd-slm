'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { cancelOrder } from '../actions'
import type { SoDisplayStatus } from '@/lib/sales-orders'

interface SoDetailActionsProps {
  soId: string
  derivedStatus: SoDisplayStatus
}

export function SoDetailActions({ soId, derivedStatus }: SoDetailActionsProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const canEdit = hasPermission('sales_orders', 'edit')
  const isTerminal = ['fulfilled', 'cancelled', 'invoiced'].includes(derivedStatus)

  const handleCancel = async () => {
    setCancelling(true)
    const result = await cancelOrder(soId)
    setCancelling(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowCancelModal(false)
      router.refresh()
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Cancel Order */}
        {canEdit && !isTerminal && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowCancelModal(true)}
          >
            Cancel Order
          </Button>
        )}
      </div>

      {/* Cancel confirmation */}
      {showCancelModal && (
        <Modal title="Cancel Sales Order" onClose={() => setShowCancelModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            This will cancel all non-terminal lines on this order. Lines that are already
            delivered will not be affected. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowCancelModal(false)}>
              Keep Order
            </Button>
            <Button size="sm" variant="danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
