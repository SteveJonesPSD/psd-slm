'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, INBOUND_PO_STATUS_CONFIG, MATCH_CONFIDENCE_CONFIG } from '@/components/ui/badge'
import { getInboundPO } from '../actions'
import { PDFViewer } from './pdf-viewer'
import { ExtractedDataForm } from './extracted-data-form'
import { QuoteMatchPanel } from './quote-match-panel'
import { LineComparison } from './line-comparison'
import { ProcessingActions } from './processing-actions'
import type { InboundPurchaseOrder, Json } from '@/types/database'

// Extended type with joined data from getInboundPO
interface InboundPOWithJoins extends InboundPurchaseOrder {
  customers: { id: string; name: string } | null
  quotes: { id: string; quote_number: string; status: string; customers: { name: string } } | null
  uploader: { id: string; first_name: string; last_name: string } | null
  reviewer: { id: string; first_name: string; last_name: string } | null
  lines: {
    id: string
    line_number: number | null
    description: string | null
    quantity: number | null
    unit_price: number | null
    line_total: number | null
    product_code: string | null
    matched_quote_line_id: string | null
    line_match_confidence: string | null
    quote_line: {
      id: string
      description: string
      quantity: number
      sell_price: number
      buy_price: number
    } | null
  }[]
  quoteLines: {
    id: string
    description: string
    quantity: number
    sell_price: number
    buy_price: number
    sort_order: number
  }[] | null
  pdfUrl: string | null
}

interface InboundPODetailProps {
  data: InboundPOWithJoins
}

export function InboundPODetail({ data: initialData }: InboundPODetailProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const isProcessing = data.status === 'uploading' || data.status === 'extracting'

  // Auto-refresh when processing
  const refresh = useCallback(async () => {
    const result = await getInboundPO(data.id)
    if (result.data) {
      setData(result.data as unknown as InboundPOWithJoins)
    }
  }, [data.id])

  useEffect(() => {
    if (!isProcessing) return
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [isProcessing, refresh])

  const statusConfig = INBOUND_PO_STATUS_CONFIG[data.status]
  const matchConfig = data.match_confidence ? MATCH_CONFIDENCE_CONFIG[data.match_confidence] : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {data.customer_po_number || 'Inbound PO'}
            </h2>
            {statusConfig && <Badge {...statusConfig} />}
            {matchConfig && <Badge {...matchConfig} />}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {data.original_filename && (
              <span>{data.original_filename}</span>
            )}
            <span>
              Uploaded {new Date(data.created_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {data.extraction_method && (
              <span className="flex items-center gap-1">
                {data.extraction_method === 'ocr_vision' ? '🔍 OCR' : '📝 Text Layer'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <div>
            <p className="text-sm font-medium text-indigo-800">
              {data.status === 'uploading' ? 'Uploading PDF...' : 'Extracting data with AI...'}
            </p>
            <p className="text-xs text-indigo-600">
              This page will update automatically.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {data.status === 'error' && data.error_message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Processing Error</p>
          <p className="text-sm text-red-700 mt-1">{data.error_message}</p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: PDF viewer */}
        <div>
          <PDFViewer
            pdfUrl={data.pdfUrl}
            filename={data.original_filename}
          />
        </div>

        {/* Right: Data + matching */}
        <div className="space-y-6">
          <ExtractedDataForm
            inboundPoId={data.id}
            fields={{
              customer_po_number: data.customer_po_number,
              customer_name: data.customer_name,
              contact_name: data.contact_name,
              po_date: data.po_date,
              total_value: data.total_value,
              delivery_address: data.delivery_address,
              special_instructions: data.special_instructions,
              our_reference: data.our_reference,
            }}
            extractionConfidence={data.extraction_confidence}
            extractedData={data.extracted_data}
            onSaved={refresh}
          />

          <QuoteMatchPanel
            inboundPoId={data.id}
            matchedQuoteId={data.matched_quote_id}
            matchedQuote={data.quotes as unknown as { id: string; quote_number: string; status: string; customers: { name: string } } | null}
            matchConfidence={data.match_confidence}
            matchMethod={data.match_method}
            onMatchChanged={() => {
              refresh()
              router.refresh()
            }}
          />
        </div>
      </div>

      {/* Line comparison (full width) */}
      {data.lines && data.lines.length > 0 && (
        <LineComparison
          poLines={data.lines}
          quoteLines={data.quoteLines}
          matchedQuoteId={data.matched_quote_id}
        />
      )}

      {/* Processing actions */}
      <ProcessingActions
        inboundPoId={data.id}
        status={data.status}
        internalNotes={data.internal_notes}
        matchedQuoteId={data.matched_quote_id}
        onAction={() => {
          refresh()
          router.refresh()
        }}
      />
    </div>
  )
}
