'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor } from '@/lib/margin'
import type { FormLine, QuoteAction, SupplierLookup } from './quote-builder-types'

interface LineItemRowProps {
  line: FormLine
  dispatch: React.Dispatch<QuoteAction>
  suppliers: SupplierLookup[]
}

export function LineItemRow({ line, dispatch, suppliers }: LineItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.tempId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const lineTotal = line.quantity * line.sell_price
  const marginAmt = (line.sell_price - line.buy_price) * line.quantity
  const marginPct = line.sell_price > 0 ? ((line.sell_price - line.buy_price) / line.sell_price) * 100 : 0
  const marginColor = getMarginColor(line.buy_price, line.sell_price)
  const hasDealReg = !!line.deal_reg_line_id
  const priceChanged = hasDealReg && line.original_deal_price != null && Math.abs(line.buy_price - line.original_deal_price) > 0.01

  const update = (updates: Partial<FormLine>) => {
    dispatch({ type: 'UPDATE_LINE', tempId: line.tempId, updates })
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t border-slate-100 text-sm ${line.is_optional ? 'bg-slate-50/50' : ''}`}
    >
      {/* Drag handle */}
      <td className="px-2 py-2 w-8">
        <button
          type="button"
          className="cursor-grab text-slate-300 hover:text-slate-500"
          {...attributes}
          {...listeners}
        >
          &#x2630;
        </button>
      </td>

      {/* Description */}
      <td className="px-2 py-2">
        <input
          type="text"
          value={line.description}
          onChange={(e) => update({ description: e.target.value })}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
          placeholder="Description"
        />
      </td>

      {/* Fulfilment Route */}
      <td className="px-2 py-2 w-28">
        <select
          value={line.fulfilment_route}
          onChange={(e) => update({ fulfilment_route: e.target.value as 'from_stock' | 'drop_ship' })}
          className="w-full rounded border border-slate-200 px-1 py-1.5 text-xs outline-none focus:border-slate-400"
        >
          <option value="from_stock">From Stock</option>
          <option value="drop_ship">Drop Ship</option>
        </select>
      </td>

      {/* Supplier */}
      <td className="px-2 py-2 w-36">
        <select
          value={line.supplier_id || ''}
          onChange={(e) => update({ supplier_id: e.target.value || null })}
          className="w-full rounded border border-slate-200 px-1 py-1.5 text-xs outline-none focus:border-slate-400"
        >
          <option value="">No supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </td>

      {/* Quantity */}
      <td className="px-2 py-2 w-20">
        <input
          type="number"
          value={line.quantity}
          onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
          min={1}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
        />
      </td>

      {/* Buy Price */}
      <td className="px-2 py-2 w-28">
        <div className="flex items-center gap-1">
          <CurrencyInput
            value={line.buy_price}
            onChange={(v) => update({ buy_price: v ?? 0 })}
            className="flex-1"
          />
          {hasDealReg && (
            <span title={`Deal reg price: ${formatCurrency(line.original_deal_price || line.buy_price)}`}>
              <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />
            </span>
          )}
          {priceChanged && (
            <span className="text-amber-500 text-xs" title="Buy price changed from deal reg price">
              &#9888;
            </span>
          )}
        </div>
      </td>

      {/* Sell Price */}
      <td className="px-2 py-2 w-28">
        <CurrencyInput
          value={line.sell_price}
          onChange={(v) => update({ sell_price: v ?? 0 })}
        />
      </td>

      {/* Margin £ */}
      <td className="px-2 py-2 w-24 text-right whitespace-nowrap">
        <span className={`text-sm font-medium ${marginColor}`}>
          {formatCurrency(marginAmt)}
        </span>
      </td>

      {/* Margin % */}
      <td className="px-2 py-2 w-16 text-right whitespace-nowrap">
        <span className={`text-sm font-medium ${marginColor}`}>
          {marginPct.toFixed(1)}%
        </span>
      </td>

      {/* Line Total */}
      <td className="px-2 py-2 w-24 text-right whitespace-nowrap font-medium">
        {formatCurrency(lineTotal)}
      </td>

      {/* Contract Required */}
      <td className="px-2 py-2 w-8 text-center">
        <input
          type="checkbox"
          checked={line.requires_contract}
          onChange={(e) => update({ requires_contract: e.target.checked })}
          title="Requires contract"
          className="rounded border-slate-300"
        />
      </td>

      {/* Optional */}
      <td className="px-2 py-2 w-8 text-center">
        <input
          type="checkbox"
          checked={line.is_optional}
          onChange={(e) => update({ is_optional: e.target.checked })}
          title="Optional line"
          className="rounded border-slate-300"
        />
      </td>

      {/* Remove */}
      <td className="px-2 py-2 w-8">
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_LINE', tempId: line.tempId })}
          className="text-slate-400 hover:text-red-500"
          title="Remove line"
        >
          &times;
        </button>
      </td>
    </tr>
  )
}
