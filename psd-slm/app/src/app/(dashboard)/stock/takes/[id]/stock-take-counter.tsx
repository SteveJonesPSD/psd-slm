'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStockTakeCount, completeStockTake, cancelStockTake } from '@/app/(dashboard)/stock/actions'

interface StockTakeLineRow {
  id: string
  product_id: string
  expected_qty: number
  counted_qty: number | null
  variance: number
  serials_found: string[] | null
  products: { id: string; name: string; sku: string; is_serialised: boolean | null } | null
}

interface StockTakeCounterProps {
  stockTakeId: string
  status: string
  lines: StockTakeLineRow[]
}

export function StockTakeCounter({ stockTakeId, status, lines }: StockTakeCounterProps) {
  const router = useRouter()
  const [localLines, setLocalLines] = useState(lines)
  const [saving, setSaving] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditable = status === 'in_progress'
  const allCounted = localLines.every(l => l.counted_qty !== null)

  const handleCountChange = async (lineId: string, value: number) => {
    setLocalLines(prev =>
      prev.map(l => l.id === lineId ? { ...l, counted_qty: value, variance: value - l.expected_qty } : l)
    )

    setSaving(lineId)
    const result = await updateStockTakeCount(lineId, value)
    setSaving(null)
    if ('error' in result) {
      setError(result.error as string)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    setError(null)
    const result = await completeStockTake(stockTakeId)
    if ('error' in result) {
      setError(result.error as string)
      setCompleting(false)
    } else {
      router.refresh()
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this stock take? No adjustments will be applied.')) return
    const result = await cancelStockTake(stockTakeId)
    if ('error' in result) {
      setError(result.error as string)
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{localLines.length}</div>
          <div className="text-xs text-slate-500">Total Lines</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {localLines.filter(l => l.counted_qty !== null).length}
          </div>
          <div className="text-xs text-emerald-600">Counted</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">
            {localLines.filter(l => l.counted_qty !== null && l.variance !== 0).length}
          </div>
          <div className="text-xs text-amber-600">With Variance</div>
        </div>
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium uppercase text-slate-400">
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Counted</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {localLines.map(line => {
              const product = line.products as { name: string; sku: string; is_serialised: boolean | null } | null
              const hasVariance = line.counted_qty !== null && line.variance !== 0
              const isCounted = line.counted_qty !== null

              return (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-400 whitespace-nowrap">
                    {product?.sku}
                  </td>
                  <td className="px-4 py-3 text-sm">{product?.name}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{line.expected_qty}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditable ? (
                      <input
                        type="number"
                        min={0}
                        value={line.counted_qty ?? ''}
                        onChange={(e) => handleCountChange(line.id, parseInt(e.target.value) || 0)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm text-right outline-none focus:border-slate-400"
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-sm font-medium">{line.counted_qty ?? '\u2014'}</span>
                    )}
                    {saving === line.id && (
                      <span className="ml-1 text-xs text-slate-400">Saving...</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap">
                    {isCounted ? (
                      <span className={
                        line.variance > 0 ? 'text-emerald-600' :
                        line.variance < 0 ? 'text-red-600' :
                        'text-slate-400'
                      }>
                        {line.variance > 0 ? `+${line.variance}` : line.variance}
                      </span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isCounted ? (
                      hasVariance ? (
                        <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Variance
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          OK
                        </span>
                      )
                    ) : (
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {isEditable && (
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel Stock Take
          </button>
          <button
            onClick={handleComplete}
            disabled={!allCounted || completing}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {completing ? 'Completing...' : 'Complete Stock Take'}
          </button>
        </div>
      )}
    </div>
  )
}
