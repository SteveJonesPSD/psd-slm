import { formatDate } from '@/lib/utils'

interface PortalAcceptedProps {
  quote: { quote_number: string; accepted_at: string | null; customer_po: string | null }
}

export function PortalAccepted({ quote }: PortalAcceptedProps) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Accepted</h2>
      <p className="text-sm text-slate-500 mb-4">
        Quote <strong>{quote.quote_number}</strong> has been accepted.
        {quote.accepted_at && ` on ${formatDate(quote.accepted_at)}`}
      </p>
      {quote.customer_po && (
        <p className="text-sm text-slate-500">
          PO Reference: <strong>{quote.customer_po}</strong>
        </p>
      )}
      <p className="text-sm text-slate-400 mt-4">
        Our team will be in touch with next steps. Thank you for your order.
      </p>
    </div>
  )
}
