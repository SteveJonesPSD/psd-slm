'use client'

import { useState } from 'react'
import { getPoDocumentUrl } from '../actions'

interface PoDownloadButtonProps {
  quoteId: string
}

export function PoDownloadButton({ quoteId }: PoDownloadButtonProps) {
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
      className="inline-flex items-center text-slate-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    </button>
  )
}
