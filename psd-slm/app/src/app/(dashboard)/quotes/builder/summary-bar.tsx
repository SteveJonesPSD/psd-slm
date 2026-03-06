'use client'

import { formatCurrency } from '@/lib/utils'
import { getMarginColor, DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER } from '@/lib/margin'
import { Button } from '@/components/ui/button'
import type { QuoteFormState } from './quote-builder-types'

interface SummaryBarProps {
  state: QuoteFormState
  onSave: () => void
  onApply: () => void
  marginThresholds?: { green: number; amber: number }
}

export function SummaryBar({ state, onSave, onApply, marginThresholds }: SummaryBarProps) {
  const nonOptionalLines = state.lines.filter((l) => !l.is_optional)

  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const totalCost = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const marginAmt = subtotal - totalCost
  const marginPct = subtotal > 0 ? (marginAmt / subtotal) * 100 : 0
  const vatAmount = subtotal * (state.vat_rate / 100)
  const grandTotal = subtotal + vatAmount

  // Use average buy/sell for color
  const avgBuy = nonOptionalLines.length > 0 ? totalCost / nonOptionalLines.reduce((s, l) => s + l.quantity, 0) : 0
  const avgSell = nonOptionalLines.length > 0 ? subtotal / nonOptionalLines.reduce((s, l) => s + l.quantity, 0) : 0
  const marginColor = getMarginColor(avgBuy, avgSell, marginThresholds?.green ?? DEFAULT_MARGIN_GREEN, marginThresholds?.amber ?? DEFAULT_MARGIN_AMBER)

  return (
    <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-[1200px] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subtotal</div>
              <div className="text-lg font-bold text-slate-900">{formatCurrency(subtotal)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cost</div>
              <div className="text-lg font-bold text-slate-500">{formatCurrency(totalCost)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Margin</div>
              <div className={`text-lg font-bold ${marginColor}`}>
                {formatCurrency(marginAmt)} ({marginPct.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">VAT ({state.vat_rate}%)</div>
              <div className="text-sm font-medium text-slate-500">{formatCurrency(vatAmount)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Grand Total</div>
              <div className="text-lg font-bold text-slate-900">{formatCurrency(grandTotal)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {state.error && (
              <span className="text-sm text-red-600 mr-2">{state.error}</span>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={onApply}
              disabled={state.saving}
            >
              {state.saving ? 'Saving...' : 'Apply'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onSave}
              disabled={state.saving}
            >
              {state.saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
