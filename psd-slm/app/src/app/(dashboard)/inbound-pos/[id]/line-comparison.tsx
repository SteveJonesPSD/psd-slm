'use client'

interface POLine {
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
}

interface QuoteLine {
  id: string
  description: string
  quantity: number
  sell_price: number
  buy_price: number
  sort_order: number
}

interface LineComparisonProps {
  poLines: POLine[]
  quoteLines: QuoteLine[] | null
  matchedQuoteId: string | null
}

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '\u2014'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val)
}

function MatchIndicator({ confidence }: { confidence: string | null }) {
  if (!confidence) return <span className="text-slate-300">\u2014</span>

  const config: Record<string, { icon: string; color: string; label: string }> = {
    exact: { icon: '\u2713', color: 'text-green-600 bg-green-50', label: 'Exact match' },
    high: { icon: '\u2713', color: 'text-blue-600 bg-blue-50', label: 'High confidence' },
    low: { icon: '!', color: 'text-amber-600 bg-amber-50', label: 'Low confidence' },
    none: { icon: '\u2717', color: 'text-red-600 bg-red-50', label: 'No match' },
  }

  const c = config[confidence] || config.none

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${c.color}`} title={c.label}>
      {c.icon}
    </span>
  )
}

export function LineComparison({ poLines, quoteLines, matchedQuoteId }: LineComparisonProps) {
  if (!poLines || poLines.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-700">Line Comparison</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          PO lines vs {matchedQuoteId ? 'matched quote lines' : 'no quote matched'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-slate-50">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">#</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Description</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Qty</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Price</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Match</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote Description</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote Qty</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote Price</th>
            </tr>
          </thead>
          <tbody>
            {poLines.map((poLine) => {
              const ql = poLine.quote_line
              const qtyMatch = ql && poLine.quantity !== null && poLine.quantity === ql.quantity
              const priceMatch = ql && poLine.unit_price !== null && Math.abs(poLine.unit_price - ql.sell_price) < 0.01

              return (
                <tr key={poLine.id} className="border-b border-slate-100">
                  <td className="px-5 py-2.5 text-slate-400">{poLine.line_number || '\u2014'}</td>
                  <td className="px-5 py-2.5 text-slate-700">{poLine.description || '\u2014'}</td>
                  <td className={`px-5 py-2.5 text-right ${ql && !qtyMatch ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>
                    {poLine.quantity ?? '\u2014'}
                  </td>
                  <td className={`px-5 py-2.5 text-right ${ql && !priceMatch ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>
                    {formatCurrency(poLine.unit_price)}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <MatchIndicator confidence={poLine.line_match_confidence} />
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">
                    {ql?.description || (
                      <span className="text-slate-300 italic">No match</span>
                    )}
                  </td>
                  <td className={`px-5 py-2.5 text-right ${ql && !qtyMatch ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>
                    {ql?.quantity ?? '\u2014'}
                  </td>
                  <td className={`px-5 py-2.5 text-right ${ql && !priceMatch ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>
                    {ql ? formatCurrency(ql.sell_price) : '\u2014'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Unmatched quote lines */}
      {matchedQuoteId && quoteLines && quoteLines.length > 0 && (
        (() => {
          const matchedIds = new Set(poLines.map((l) => l.matched_quote_line_id).filter(Boolean))
          const unmatched = quoteLines.filter((ql) => !matchedIds.has(ql.id))

          if (unmatched.length === 0) return null

          return (
            <div className="border-t border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-amber-600 mb-2">
                {unmatched.length} quote line{unmatched.length === 1 ? '' : 's'} not matched to PO
              </p>
              <div className="space-y-1">
                {unmatched.map((ql) => (
                  <div key={ql.id} className="flex items-center justify-between text-xs text-slate-500 bg-amber-50 rounded px-2 py-1">
                    <span>{ql.description}</span>
                    <span>x{ql.quantity} @ {formatCurrency(ql.sell_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()
      )}
    </div>
  )
}
