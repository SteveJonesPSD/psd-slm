'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelCollection } from '@/lib/collections/actions'
import { Button } from '@/components/ui/button'
import type { JobCollectionWithDetails } from '@/lib/collections/types'

export function CollectionDetailActions({ collection }: { collection: JobCollectionWithDetails }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)

  const handlePrintSlip = () => {
    window.open(`/api/collections/${collection.id}/slip`, '_blank')
  }

  const handleCancel = async () => {
    setCancelling(true)
    const result = await cancelCollection(collection.id)
    setCancelling(false)
    if (result.error) {
      alert(result.error)
    } else {
      setShowConfirmCancel(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={handlePrintSlip}>
        Print Slip
      </Button>

      {collection.status === 'pending' && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowConfirmCancel(true)}
        >
          Cancel
        </Button>
      )}

      {/* Cancel confirmation modal */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Collection?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will cancel collection slip <strong>{collection.slip_number}</strong>. The engineer will not be able to confirm it.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="default" size="sm" onClick={() => setShowConfirmCancel(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel Collection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
