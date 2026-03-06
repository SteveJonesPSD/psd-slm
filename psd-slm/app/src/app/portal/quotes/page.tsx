import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalQuotes } from '@/lib/portal/quotes-actions'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
}

export default async function PortalQuotesPage() {
  const ctx = await requirePortalSession()
  const quotes = await getPortalQuotes(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Your Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">View and respond to your quotes</p>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No quotes to display
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <Link
              key={q.id}
              href={`/portal/quotes/${q.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{q.quoteNumber}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[q.status] || 'bg-slate-100 text-slate-600'}`}>
                      {q.status}
                    </span>
                  </div>
                  {q.title && <p className="mt-0.5 text-sm text-slate-600">{q.title}</p>}
                  {q.customerNotes && (
                    <p className="mt-0.5 text-xs text-slate-400 truncate">{q.customerNotes.substring(0, 80)}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>{formatDate(q.createdAt)}</span>
                    {q.validUntil && <span>Valid until {formatDate(q.validUntil)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-900">{formatCurrency(q.totalExVat)}</div>
                  <div className="text-xs text-slate-400">ex-VAT</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
