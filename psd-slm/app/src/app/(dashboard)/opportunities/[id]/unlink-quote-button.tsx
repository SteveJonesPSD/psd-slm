'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { unlinkQuoteFromOpportunity } from '@/app/(dashboard)/pipeline/actions'

interface UnlinkQuoteButtonProps {
  quoteId: string
  opportunityId: string
}

export function UnlinkQuoteButton({ quoteId, opportunityId }: UnlinkQuoteButtonProps) {
  const router = useRouter()
  const [unlinking, setUnlinking] = useState(false)

  const handleUnlink = async () => {
    if (!confirm('Unlink this quote from the opportunity?')) return
    setUnlinking(true)
    await unlinkQuoteFromOpportunity(quoteId, opportunityId)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleUnlink}
      disabled={unlinking}
      className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
      title="Unlink quote"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
