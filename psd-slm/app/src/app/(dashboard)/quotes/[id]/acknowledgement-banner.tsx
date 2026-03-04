'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { acknowledgeQuoteAcceptance, getPoDocumentUrl, getSignatureImageUrl } from '../actions'
import { formatDate } from '@/lib/utils'

interface AcknowledgementBannerProps {
  quoteId: string
  customerPo: string | null
  hasPoDocument: boolean
  acknowledgedAt: string | null
  acknowledgedByName: string | null
  signedByName: string | null
  hasSignature: boolean
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

function SignatureHover({ quoteId, signedByName }: { quoteId: string; signedByName: string }) {
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const handleMouseEnter = async () => {
    if (fetched) return
    setLoading(true)
    const result = await getSignatureImageUrl(quoteId)
    if ('url' in result && result.url) {
      setSigUrl(result.url)
    }
    setLoading(false)
    setFetched(true)
  }

  return (
    <span className="relative group inline-flex items-center gap-1">
      <span
        onMouseEnter={handleMouseEnter}
        className="inline-flex items-center gap-1 border-b border-dotted border-emerald-400 cursor-default"
      >
        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        <span>Signed by {signedByName}</span>
      </span>
      <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
        <span className="block rounded-lg border border-slate-200 bg-white shadow-lg p-3 w-64">
          <span className="block text-xs font-medium text-slate-500 mb-2">E-Signature</span>
          {loading && <span className="block text-xs text-slate-400">Loading...</span>}
          {sigUrl && (
            <img src={sigUrl} alt={`Signature by ${signedByName}`} className="w-full h-auto rounded border border-slate-100" />
          )}
          {fetched && !sigUrl && !loading && (
            <span className="block text-xs text-slate-400">Signature not available</span>
          )}
        </span>
      </span>
    </span>
  )
}

export function AcknowledgementBanner({
  quoteId,
  customerPo,
  hasPoDocument,
  acknowledgedAt,
  acknowledgedByName,
  signedByName,
  hasSignature,
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Acknowledged by <strong>{acknowledgedByName || 'Unknown'}</strong> on {formatDate(acknowledgedAt)}.
            {signedByName && hasSignature && (
              <> <SignatureHover quoteId={quoteId} signedByName={signedByName} />.</>
            )}
            {signedByName && !hasSignature && (
              <> Signed by <strong>{signedByName}</strong>.</>
            )}
            {' '}Ready for Sales Order conversion.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 mb-6">
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
            {signedByName && hasSignature && (
              <><SignatureHover quoteId={quoteId} signedByName={signedByName} />. </>
            )}
            {signedByName && !hasSignature && (
              <>Signed by <strong>{signedByName}</strong>. </>
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
