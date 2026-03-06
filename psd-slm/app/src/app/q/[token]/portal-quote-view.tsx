import { formatCurrency, formatDate } from '@/lib/utils'
import { PortalActions } from './portal-actions'
import { PortalPdfButton } from './portal-pdf-button'

interface PortalQuoteViewProps {
  quote: {
    id: string
    quote_number: string
    title: string | null
    status: string
    version: number
    vat_rate: number
    valid_until: string | null
    customer_notes: string | null
    sent_at: string | null
    customers: { name: string; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null } | null
    contacts: { first_name: string; last_name: string; email: string | null } | null
    brands: { name: string; logo_path: string | null; phone: string | null; email: string | null; website: string | null; footer_text: string | null } | null
    quote_groups: { id: string; name: string; sort_order: number }[]
    quote_lines: { id: string; group_id: string | null; sort_order: number; description: string; quantity: number; sell_price: number; is_optional: boolean; requires_contract: boolean }[]
  }
  token: string
}

export function PortalQuoteView({ quote, token }: PortalQuoteViewProps) {
  const nonOptionalLines = quote.quote_lines.filter((l) => !l.is_optional)
  const optionalLines = quote.quote_lines.filter((l) => l.is_optional)
  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const vatAmount = subtotal * (quote.vat_rate / 100)
  const grandTotal = subtotal + vatAmount

  const groups = [...quote.quote_groups].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      {/* Quote header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        {/* Brand header */}
        {quote.brands && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            {quote.brands.logo_path && (
              <img src={quote.brands.logo_path} alt={quote.brands.name} className="h-10 object-contain" />
            )}
            <span className="text-lg font-bold text-slate-900">{quote.brands.name}</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quotation</h1>
            <p className="text-sm text-slate-500 mt-1">
              {quote.quote_number}
              {quote.version > 1 && ` (Revision ${quote.version})`}
            </p>
            {quote.title && (
              <p className="text-sm font-medium text-slate-700 mt-1">{quote.title}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 mb-2">
              {quote.sent_at && <p>Sent: {formatDate(quote.sent_at)}</p>}
              {quote.valid_until && <p>Valid until: {formatDate(quote.valid_until)}</p>}
            </div>
            <PortalPdfButton quoteId={quote.id} quoteNumber={quote.quote_number} token={token} />
          </div>
        </div>

        {/* Customer details */}
        {quote.customers && (
          <div className="mb-4 text-sm">
            <div className="font-semibold text-slate-700">{quote.customers.name}</div>
            {quote.customers.address_line1 && <div className="text-slate-500">{quote.customers.address_line1}</div>}
            {quote.customers.address_line2 && <div className="text-slate-500">{quote.customers.address_line2}</div>}
            {(quote.customers.city || quote.customers.postcode) && (
              <div className="text-slate-500">
                {[quote.customers.city, quote.customers.postcode].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {quote.contacts && (
          <div className="text-sm text-slate-500">
            Attn: {quote.contacts.first_name} {quote.contacts.last_name}
            {quote.contacts.email && ` (${quote.contacts.email})`}
          </div>
        )}
      </div>

      {/* Line items grouped with section headers */}
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-6 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-20">Qty</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-28">Unit Price</th>
              <th className="px-6 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupLines = quote.quote_lines
                .filter((l) => l.group_id === group.id && !l.is_optional)
                .sort((a, b) => a.sort_order - b.sort_order)
              if (groupLines.length === 0) return null
              return [
                groups.length > 1 && (
                  <tr key={`group-${group.id}`}>
                    <td colSpan={4} className="bg-slate-50 px-6 py-2 border-t border-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{group.name}</span>
                    </td>
                  </tr>
                ),
                ...groupLines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="px-6 py-2.5">
                      {line.description}
                      {line.requires_contract && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Contract Required
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{line.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(line.sell_price)}</td>
                    <td className="px-6 py-2.5 text-right font-medium">{formatCurrency(line.quantity * line.sell_price)}</td>
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t-2 border-slate-200 px-6 py-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT ({quote.vat_rate}%)</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-1.5">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optional items */}
      {optionalLines.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white mb-6">
          <div className="px-6 py-4 bg-slate-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-slate-700">Optional Items</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {optionalLines.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="px-6 py-2.5 text-slate-600">{line.description}</td>
                  <td className="px-4 py-2.5 text-right w-20">{line.quantity}</td>
                  <td className="px-4 py-2.5 text-right w-28">{formatCurrency(line.sell_price)}</td>
                  <td className="px-6 py-2.5 text-right w-28 font-medium">{formatCurrency(line.quantity * line.sell_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Notes */}
      {quote.customer_notes && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 mb-6">
          <h3 className="text-[13px] font-semibold text-blue-800 mb-2">Notes</h3>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{quote.customer_notes}</p>
        </div>
      )}

      {/* Brand footer / Terms */}
      {quote.brands?.footer_text && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-6">
          <p className="text-xs text-slate-500 whitespace-pre-wrap">{quote.brands.footer_text}</p>
        </div>
      )}

      {/* Brand contact */}
      {quote.brands && (quote.brands.phone || quote.brands.email || quote.brands.website) && (
        <div className="text-center text-xs text-slate-400 mb-6 space-x-3">
          {quote.brands.phone && <span>{quote.brands.phone}</span>}
          {quote.brands.email && <span>{quote.brands.email}</span>}
          {quote.brands.website && <span>{quote.brands.website}</span>}
        </div>
      )}

      {/* Actions */}
      <PortalActions quoteId={quote.id} token={token} />
    </div>
  )
}
