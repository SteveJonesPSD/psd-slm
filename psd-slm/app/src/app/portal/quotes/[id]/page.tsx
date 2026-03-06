import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalQuoteDetail } from '@/lib/portal/quotes-actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { QuoteAcceptDecline } from './quote-accept-decline'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PortalQuoteDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await requirePortalSession()
  const data = await getPortalQuoteDetail(id, ctx)

  if (!data) notFound()

  const { quote, lines, groups } = data

  // Group lines by group
  const ungrouped = lines.filter((l) => !l.groupId && !l.isHiddenService)
  const grouped = groups.map((g) => ({
    ...g,
    lines: lines.filter((l) => l.groupId === g.id && !l.isHiddenService),
  }))

  return (
    <div>
      <Link href="/portal/quotes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Quotes
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{quote.quoteNumber}</h1>
          {quote.title && <p className="mt-0.5 text-sm text-slate-600">{quote.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{formatDate(quote.createdAt)}</span>
            {quote.validUntil && <span>Valid until {formatDate(quote.validUntil)}</span>}
            <span className={`rounded-full px-2 py-0.5 font-medium ${
              quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
              quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
              quote.status === 'declined' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {quote.status}
            </span>
          </div>
        </div>

        {quote.status === 'sent' && <QuoteAcceptDecline quoteId={quote.id} />}
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 font-medium text-slate-600">Description</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-20">Qty</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-28">Unit Price</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-28">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grouped.map((g) => (
              g.lines.length > 0 && (
                <GroupRows key={g.id} groupName={g.name} lines={g.lines} />
              )
            ))}
            {ungrouped.length > 0 && (
              <GroupRows groupName={groups.length > 0 ? 'Other Items' : undefined} lines={ungrouped} />
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-500">Subtotal (ex-VAT)</span>
          <span className="font-medium text-slate-900">{formatCurrency(quote.totalExVat)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-500">VAT ({quote.vatRate}%)</span>
          <span className="font-medium text-slate-900">{formatCurrency(quote.totalIncVat - quote.totalExVat)}</span>
        </div>
        <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2">
          <span className="text-slate-900">Total (inc-VAT)</span>
          <span className="text-slate-900">{formatCurrency(quote.totalIncVat)}</span>
        </div>
      </div>

      {quote.customerNotes && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.customerNotes}</p>
        </div>
      )}
    </div>
  )
}

function GroupRows({ groupName, lines }: { groupName?: string; lines: { id: string; description: string; quantity: number; sellPrice: number; isOptional: boolean }[] }) {
  return (
    <>
      {groupName && (
        <tr>
          <td colSpan={4} className="px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {groupName}
          </td>
        </tr>
      )}
      {lines.map((l) => (
        <tr key={l.id} className={l.isOptional ? 'opacity-60' : ''}>
          <td className="px-5 py-3 text-slate-700">
            {l.description}
            {l.isOptional && <span className="ml-2 text-xs text-amber-600">(optional)</span>}
          </td>
          <td className="px-5 py-3 text-right text-slate-600">{l.quantity}</td>
          <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(l.sellPrice)}</td>
          <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(l.quantity * l.sellPrice)}</td>
        </tr>
      ))}
    </>
  )
}
