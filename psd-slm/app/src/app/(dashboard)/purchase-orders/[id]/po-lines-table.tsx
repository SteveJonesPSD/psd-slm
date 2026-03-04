'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, PO_LINE_STATUS_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { receivePoGoods, updatePoLineCost } from '../actions'

interface PoLine {
  id: string
  purchase_order_id: string
  sales_order_line_id: string | null
  product_id: string | null
  sort_order: number
  description: string
  quantity: number
  unit_cost: number
  quantity_received: number
  serial_numbers: string[] | null
  status: string
  products: { id: string; name: string; sku: string; is_serialised: boolean | null; product_type?: string; product_categories?: { requires_serial: boolean } | null } | null
  sales_order_lines: { id: string; buy_price: number; sell_price: number; quantity: number; fulfilment_route: string | null; delivery_destination: string | null } | null
}

interface PoLinesTableProps {
  lines: PoLine[]
  poId: string
  poStatus: string
  deliveryCost: number
  isStockOrder?: boolean
}

export function PoLinesTable({ lines, poId, poStatus, deliveryCost, isStockOrder = false }: PoLinesTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [receiveModal, setReceiveModal] = useState<PoLine | null>(null)
  const [receiveQty, setReceiveQty] = useState(1)
  const [receiveSerials, setReceiveSerials] = useState('')
  const [receiveError, setReceiveError] = useState<string | null>(null)
  const [editingCost, setEditingCost] = useState<Record<string, number>>({})

  const isDraft = poStatus === 'draft'
  const canReceive = ['sent', 'acknowledged', 'partially_received'].includes(poStatus)

  const handleCostChange = (lineId: string, value: number) => {
    setEditingCost((prev) => ({ ...prev, [lineId]: value }))
  }

  const handleCostBlur = async (lineId: string) => {
    const newCost = editingCost[lineId]
    if (newCost === undefined) return

    const line = lines.find((l) => l.id === lineId)
    if (!line || newCost === line.unit_cost) return

    setLoading(lineId)
    await updatePoLineCost(poId, lineId, newCost)
    setLoading(null)
    router.refresh()
  }

  const openReceiveModal = (line: PoLine) => {
    const remaining = line.quantity - line.quantity_received
    setReceiveModal(line)
    setReceiveQty(remaining)
    setReceiveSerials('')
    setReceiveError(null)
  }

  const handleReceiveGoods = async () => {
    if (!receiveModal) return
    setReceiveError(null)

    const serialNumbers = receiveSerials.trim()
      ? receiveSerials.trim().split('\n').map((s) => s.trim()).filter(Boolean)
      : []

    // Resolve serialisation using tri-state logic: true=always, false=never, null=inherit from category
    const p = receiveModal.products
    const requiresSerials = p
      ? (p.product_type === 'service' ? false : (p.is_serialised === true ? true : (p.is_serialised === false ? false : (p.product_categories?.requires_serial ?? false))))
      : false
    if (requiresSerials && serialNumbers.length !== receiveQty) {
      setReceiveError(`Enter exactly ${receiveQty} serial number(s), one per line. You entered ${serialNumbers.length}.`)
      return
    }

    // Self-duplicate check
    if (serialNumbers.length > 0) {
      const seen = new Set<string>()
      const dupes: string[] = []
      for (const sn of serialNumbers) {
        if (seen.has(sn)) dupes.push(sn)
        seen.add(sn)
      }
      if (dupes.length > 0) {
        setReceiveError(`Duplicate serial number(s) entered: ${[...new Set(dupes)].join(', ')}`)
        return
      }

      // Cross-line check: compare against other PO lines with same product
      const otherLineSerials = lines
        .filter((l) => l.id !== receiveModal.id && l.product_id === receiveModal.product_id)
        .flatMap((l) => l.serial_numbers || [])
      const crossDupes = serialNumbers.filter((sn) => otherLineSerials.includes(sn))
      if (crossDupes.length > 0) {
        setReceiveError(`Serial number(s) already received on another line of this PO: ${crossDupes.join(', ')}`)
        return
      }
    }

    setLoading(receiveModal.id)
    const result = await receivePoGoods({
      poId,
      lineId: receiveModal.id,
      quantityReceived: receiveQty,
      serialNumbers,
    })
    setLoading(null)

    if ('error' in result && result.error) {
      setReceiveError(result.error)
    } else {
      const autoAllocated = 'autoAllocated' in result && result.autoAllocated
      setReceiveModal(null)
      if (autoAllocated) {
        alert('Goods received and auto-allocated to the linked sales order')
      }
      router.refresh()
    }
  }

  // Totals
  const activeLines = lines.filter((l) => l.status !== 'cancelled')
  const goodsTotal = activeLines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)
  const poTotal = goodsTotal + deliveryCost

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <div className="px-5 py-4">
          <h3 className="text-[15px] font-semibold">Order Lines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                {!isStockOrder && <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route</th>}
                <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Received</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit Cost</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Line Total</th>
                {!isStockOrder && <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quoted Buy</th>}
                {!isStockOrder && <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variance</th>}
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Serials</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const statusCfg = PO_LINE_STATUS_CONFIG[line.status]
                const isCancelled = line.status === 'cancelled'
                const lineTotal = line.quantity * line.unit_cost
                const quotedBuy = (line.sales_order_lines as { buy_price: number } | null)?.buy_price || 0
                const lineVariance = (line.unit_cost - quotedBuy) * line.quantity
                const hasSerials = line.serial_numbers && line.serial_numbers.length > 0
                const p = line.products
                const isSerialisedProduct = p
                  ? (p.product_type === 'service' ? false : (p.is_serialised === true ? true : (p.is_serialised === false ? false : (p.product_categories?.requires_serial ?? false))))
                  : false
                const canReceiveLine = canReceive && !['received', 'cancelled'].includes(line.status)
                const costValue = editingCost[line.id] !== undefined ? editingCost[line.id] : line.unit_cost

                return (
                  <tr key={line.id} className={`border-t border-slate-100 ${isCancelled ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-2.5">
                      <div className={isCancelled ? 'line-through text-slate-400' : 'font-medium'}>
                        {line.description}
                      </div>
                      {line.products && (
                        <div className="text-xs text-slate-400">{line.products.sku}</div>
                      )}
                    </td>
                    {!isStockOrder && (
                    <td className="px-5 py-2.5">
                      {(() => {
                        const soLine = line.sales_order_lines as { fulfilment_route: string | null } | null
                        const route = soLine?.fulfilment_route
                        const routeCfg = route ? FULFILMENT_ROUTE_CONFIG?.[route as keyof typeof FULFILMENT_ROUTE_CONFIG] : null
                        return routeCfg ? (
                          <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
                        ) : (
                          <span className="text-xs text-slate-400">{'\u2014'}</span>
                        )
                      })()}
                    </td>
                    )}
                    <td className="px-5 py-2.5 text-center">{line.quantity}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={line.quantity_received < line.quantity ? (line.quantity_received > 0 ? 'text-amber-600 font-medium' : '') : 'text-emerald-600 font-medium'}>
                        {line.quantity_received}
                      </span>
                      <span className="text-slate-400">/{line.quantity}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {isDraft && !isCancelled ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costValue}
                          onChange={(e) => handleCostChange(line.id, parseFloat(e.target.value) || 0)}
                          onBlur={() => handleCostBlur(line.id)}
                          disabled={loading === line.id}
                          className="w-24 rounded border border-slate-200 px-2 py-0.5 text-sm text-right outline-none focus:border-slate-400"
                        />
                      ) : (
                        formatCurrency(line.unit_cost)
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
                    {!isStockOrder && (
                    <td className="px-5 py-2.5 text-right text-slate-400 text-xs">{formatCurrency(quotedBuy)}</td>
                    )}
                    {!isStockOrder && (
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {lineVariance !== 0 ? (
                        <span className={`text-xs font-medium ${lineVariance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {lineVariance > 0 ? '+' : ''}{formatCurrency(lineVariance)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-600">{formatCurrency(0)}</span>
                      )}
                    </td>
                    )}
                    <td className="px-5 py-2.5">
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                    </td>
                    <td className="px-5 py-2.5">
                      {hasSerials ? (
                        <span title={line.serial_numbers!.join(', ')} className="cursor-help text-xs text-slate-500">
                          {line.serial_numbers!.length} SN{line.serial_numbers!.length !== 1 ? 's' : ''}
                        </span>
                      ) : isSerialisedProduct ? (
                        <span className="text-xs text-amber-500">Pending</span>
                      ) : (
                        <span className="text-xs text-slate-300">N/A</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {canReceiveLine && (
                        <button
                          onClick={() => openReceiveModal(line)}
                          disabled={loading === line.id}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-teal-600 hover:bg-teal-50 border border-teal-200 transition-colors disabled:opacity-50"
                        >
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        <div className="border-t border-gray-200 px-5 py-3 space-y-1">
          <div className="flex justify-end gap-4 text-sm">
            <span className="text-slate-400">Goods subtotal:</span>
            <span className="font-medium w-28 text-right">{formatCurrency(goodsTotal)}</span>
          </div>
          {deliveryCost > 0 && (
            <div className="flex justify-end gap-4 text-sm">
              <span className="text-slate-400">Delivery:</span>
              <span className="font-medium w-28 text-right">{formatCurrency(deliveryCost)}</span>
            </div>
          )}
          <div className="flex justify-end gap-4 text-sm pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">PO Total:</span>
            <span className="font-bold w-28 text-right">{formatCurrency(poTotal)}</span>
          </div>
        </div>
      </div>

      {/* Receive Goods modal */}
      {receiveModal && (
        <Modal title="Receive Goods" onClose={() => setReceiveModal(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">
                <strong>{receiveModal.description}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Ordered: {receiveModal.quantity} | Received so far: {receiveModal.quantity_received} | Remaining: {receiveModal.quantity - receiveModal.quantity_received}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity This Delivery
              </label>
              <input
                type="number"
                min={1}
                max={receiveModal.quantity - receiveModal.quantity_received}
                value={receiveQty}
                onChange={(e) => setReceiveQty(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            {(() => {
              const p = receiveModal.products
              const showSerials = p
                ? (p.product_type === 'service' ? false : (p.is_serialised === true ? true : (p.is_serialised === false ? false : (p.product_categories?.requires_serial ?? false))))
                : false
              return showSerials
            })() && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Serial Numbers <span className="text-xs text-slate-400">(one per line, {receiveQty} required)</span>
                </label>
                <textarea
                  value={receiveSerials}
                  onChange={(e) => setReceiveSerials(e.target.value)}
                  rows={Math.min(receiveQty, 8)}
                  placeholder={`Enter ${receiveQty} serial number(s), one per line`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
                />
                {(() => {
                  const enteredCount = receiveSerials.trim() ? receiveSerials.trim().split('\n').filter(s => s.trim()).length : 0
                  const isMatch = enteredCount === receiveQty
                  return (
                    <p className={`text-xs mt-1 ${isMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {enteredCount} of {receiveQty} serial number{receiveQty !== 1 ? 's' : ''} entered
                      {isMatch && ' \u2713'}
                    </p>
                  )
                })()}
              </div>
            )}

            {receiveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {receiveError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="default" onClick={() => setReceiveModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleReceiveGoods}
                disabled={loading === receiveModal.id || receiveQty <= 0}
              >
                {loading === receiveModal.id ? 'Receiving...' : `Receive ${receiveQty} Item${receiveQty !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
