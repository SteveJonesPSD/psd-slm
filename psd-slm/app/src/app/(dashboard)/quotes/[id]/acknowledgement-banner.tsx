'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { acknowledgeQuoteAcceptance, getPoDocumentUrl } from '../actions'
import { formatDate } from '@/lib/utils'

interface AcknowledgementBannerProps {
  quoteId: string
  customerPo: string | null
  hasPoDocument: boolean
  acknowledgedAt: string | null
  acknowledgedByName: string | null
}

function PoDownloadButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    const result = await getPoDocumentUrl(quoteId)
    setLoading(false)
    if ('url' in result && result.url) {
      window.open(result.url, '_blank')
    } else {
      alert(result.error || 'Failed to get download link')
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title="Download PO document"
      className="inline-flex items-center text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    </button>
  )
}

export function AcknowledgementBanner({
  quoteId,
  customerPo,
  hasPoDocument,
  acknowledgedAt,
  acknowledgedByName,
}: AcknowledgementBannerProps) {
  const router = useRouter()
  const [acknowledging, setAcknowledging] = useState(false)

  const handleAcknowledge = async () => {
    setAcknowledging(true)
    const result = await acknowledgeQuoteAcceptance(quoteId)
    setAcknowledging(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  if (acknowledgedAt) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Acknowledged by <strong>{acknowledgedByName || 'Unknown'}</strong> on {formatDate(acknowledgedAt)}.
            Ready for Sales Order conversion.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-emerald-800">
              Quote Accepted by Customer
            </h3>
          </div>
          <p className="text-sm text-emerald-700 ml-7">
            {customerPo && (
              <>Customer PO: <strong>{customerPo}</strong>{hasPoDocument && <> <PoDownloadButton quoteId={quoteId} /></>}. </>
            )}
            Review the order details and acknowledge to proceed.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleAcknowledge}
          disabled={acknowledging}
        >
          {acknowledging ? 'Acknowledging...' : 'Acknowledge Acceptance'}
        </Button>
      </div>
    </div>
  )
}
