'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { reactivateQuote } from '../actions'

interface RevisedBannerProps {
  quoteId: string
  activeVersionId: string | null
  activeVersionNumber: string | null
}

export function RevisedBanner({ quoteId, activeVersionId, activeVersionNumber }: RevisedBannerProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [acting, setActing] = useState(false)

  const handleReactivate = async () => {
    setActing(true)
    const result = await reactivateQuote(quoteId)
    setActing(false)
    setShowConfirm(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">This quote has been revised</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {activeVersionId ? (
              <>
                The active version is{' '}
                <a
                  href={`/quotes/${activeVersionId}`}
                  className="font-medium underline hover:text-amber-900"
                >
                  {activeVersionNumber || 'latest version'}
                </a>
                .
              </>
            ) : (
              'No active version found in this family.'
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => setShowConfirm(true)}
        >
          Reactivate This Version
        </Button>
      </div>

      {showConfirm && (
        <Modal title="Reactivate Version" onClose={() => setShowConfirm(false)}>
          <p className="text-sm text-slate-600 mb-4">
            This will reactivate this version and mark the current active version as revised. Continue?
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleReactivate} disabled={acting}>
              {acting ? 'Reactivating...' : 'Reactivate'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
