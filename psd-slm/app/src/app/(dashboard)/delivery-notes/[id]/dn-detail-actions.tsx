'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { updateDnStatus } from '../actions'
import { getDnValidTransitions } from '@/lib/stock'

interface DnDetailActionsProps {
  dnId: string
  status: string
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  confirmed: 'Confirm',
  dispatched: 'Mark Dispatched',
  delivered: 'Mark Delivered',
  cancelled: 'Cancel',
}

export function DnDetailActions({ dnId, status }: DnDetailActionsProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [loading, setLoading] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)

  const canEdit = hasPermission('delivery_notes', 'edit')
  const validTransitions = getDnValidTransitions(status)

  if (!canEdit || validTransitions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/api/delivery-notes/${dnId}/pdf`}
          target="_blank"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
        >
          Download PDF
        </Link>
      </div>
    )
  }

  const handleTransition = async (newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancelModal(true)
      return
    }

    setLoading(true)
    const result = await updateDnStatus(dnId, newStatus)
    setLoading(false)
    if ('error' in result) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleConfirmCancel = async () => {
    setCancelModal(false)
    setLoading(true)
    const result = await updateDnStatus(dnId, 'cancelled')
    setLoading(false)
    if ('error' in result) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/api/delivery-notes/${dnId}/pdf`}
          target="_blank"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
        >
          Download PDF
        </Link>
        {validTransitions.filter(t => t !== 'cancelled').map(t => (
          <Button
            key={t}
            size="sm"
            variant="primary"
            onClick={() => handleTransition(t)}
            disabled={loading}
          >
            {loading ? '...' : STATUS_ACTION_LABELS[t] || t}
          </Button>
        ))}
        {validTransitions.includes('cancelled') && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleTransition('cancelled')}
            disabled={loading}
          >
            Cancel DN
          </Button>
        )}
      </div>

      {cancelModal && (
        <Modal title="Cancel Delivery Note" onClose={() => setCancelModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to cancel this delivery note? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setCancelModal(false)}>Keep</Button>
            <Button size="sm" variant="danger" onClick={handleConfirmCancel} disabled={loading}>
              {loading ? 'Cancelling...' : 'Cancel Delivery Note'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
