'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, SO_LINE_STATUS_CONFIG, FULFILMENT_ROUTE_CONFIG, DELIVERY_DESTINATION_CONFIG, PO_STATUS_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor, getMarginColorFromPct, DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER } from '@/lib/margin'
import { getValidTransitions } from '@/lib/sales-orders'
import { updateLineStatus, updateSoLineSupplier } from '../actions'

interface SoLine {
  id: string
  sales_order_id: string
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: string
  status: string
  delivery_destination: string | null
  group_name: string | null
  group_sort: number
  requires_contract: boolean
  deal_reg_line_id: string | null
  is_service: boolean
  quantity_received: number
  serial_numbers_received: string[]
  supplier_id: string | null
  products: { id: string; name: string; sku: string; is_stocked: boolean; is_serialised: boolean | null } | null
  suppliers: { id: string; name: string } | null
}

interface SupplierOption {
  id: string
  name: string
}

interface PoRef {
  id: string
  po_number: string
  status: string
  delivery_destination: string
  delivery_cost: number
  suppliers: { id: string; name: string } | { id: string; name: string }[] | null
  purchase_order_lines: { id: string; sales_order_line_id: string; quantity: number; unit_cost: number; status: string }[]
}

interface ProductSupplierLink {
  product_id: string
  supplier_id: string
  is_preferred: boolean
}

interface SoLinesTableProps {
  lines: SoLine[]
  soId: string
  suppliers?: SupplierOption[]
  productSuppliers?: ProductSupplierLink[]
  purchaseOrders?: PoRef[]
  marginThresholds?: { green: number; amber: number }
}

const ACTION_LABELS: Record<string, string> = {
  picked: 'Mark Picked',
  ordered: 'Mark Ordered',
  delivered: 'Deliver',
  cancelled: 'Cancel',
}

export function SoLinesTable({ lines, soId, suppliers = [], productSuppliers = [], purchaseOrders = [], marginThresholds }: SoLinesTableProps) {
  const greenT = marginThresholds?.green ?? DEFAULT_MARGIN_GREEN
  const amberT = marginThresholds?.amber ?? DEFAULT_MARGIN_AMBER
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [changingSupplier, setChangingSupplier] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<{ lineId: string; description: string } | null>(null)

  // Build PO line lookup: SO line ID → PO info
  const poLineMap = new Map<string, { poId: string; poNumber: string; poStatus: string; poLineStatus: string }>()
  for (const po of purchaseOrders) {
    for (const pol of po.purchase_order_lines) {
      if (pol.sales_order_line_id) {
        poLineMap.set(pol.sales_order_line_id, {
          poId: po.id,
          poNumber: po.po_number,
          poStatus: po.status,
          poLineStatus: pol.status,
        })
      }
    }
  }

  // PO-aware label helper
  const getPoAwareLabel = (soLine: SoLine): { label: string; color: string; bg: string } | null => {
    if (soLine.is_service) return null
    const poInfo = poLineMap.get(soLine.id)
    if (!poInfo) {
      // No PO and pending drop-ship
      if (soLine.status === 'pending' && soLine.fulfilment_route === 'drop_ship') {
        return { label: 'Awaiting PO', color: '#6b7280', bg: '#f3f4f6' }
      }
      return null
    }
    if (poInfo.poStatus === 'cancelled') {
      return { label: 'PO Cancelled', color: '#dc2626', bg: '#fef2f2' }
    }
    if (poInfo.poStatus === 'draft') {
      return { label: 'PO in Draft', color: '#d97706', bg: '#fffbeb' }
    }
    if (poInfo.poLineStatus === 'partial_received') {
      return { label: 'Partially Received', color: '#d97706', bg: '#fffbeb' }
    }
    // Don't show PO "Received" badge when SO line status already says received
    if (poInfo.poLineStatus === 'received') {
      if (['received', 'allocated', 'picked', 'delivered'].includes(soLine.status)) return null
      return { label: 'Received', color: '#059669', bg: '#ecfdf5' }
    }
    if (poInfo.poLineStatus === 'ordered' || poInfo.poStatus === 'sent' || poInfo.poStatus === 'acknowledged') {
      return { label: 'On PO', color: '#2563eb', bg: '#eff6ff' }
    }
    return null
  }

  const handleTransition = async (lineId: string, newStatus: string) => {
    if (newStatus === 'cancelled') {
      const line = lines.find((l) => l.id === lineId)
      setCancelConfirm({ lineId, description: line?.description || '' })
      return
    }
    setLoading(lineId)
    const result = await updateLineStatus(soId, lineId, newStatus)
    setLoading(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const confirmCancelLine = async () => {
    if (!cancelConfirm) return
    setLoading(cancelConfirm.lineId)
    setCancelConfirm(null)
    const result = await updateLineStatus(soId, cancelConfirm.lineId, 'cancelled')
    setLoading(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleSupplierChange = async (lineId: string, newSupplierId: string) => {
    setChangingSupplier(lineId)
    const result = await updateSoLineSupplier(soId, lineId, newSupplierId)
    setChangingSupplier(null)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  // Group lines
  const groupNames = [...new Set(lines.filter((l) => l.group_name).map((l) => l.group_name!))]
    .sort((a, b) => {
      const aSort = lines.find((l) => l.group_name === a)?.group_sort ?? 0
      const bSort = lines.find((l) => l.group_name === b)?.group_sort ?? 0
      return aSort - bSort
    })
  const ungroupedLines = lines.filter((l) => !l.group_name).sort((a, b) => a.sort_order - b.sort_order)

  // Totals
  const activeLines = lines.filter((l) => l.status !== 'cancelled')
  const totalSell = activeLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const totalCost = activeLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const totalMargin = totalSell - totalCost
  const totalMarginPct = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0

  const renderLineRow = (line: SoLine) => {
    const lineTotal = line.quantity * line.sell_price
    const lineMarginPct = line.sell_price > 0
      ? ((line.sell_price - line.buy_price) / line.sell_price) * 100
      : 0
    const mColor = getMarginColor(line.buy_price, line.sell_price, greenT, amberT)
    const statusCfg = SO_LINE_STATUS_CONFIG[line.status]
    const routeCfg = FULFILMENT_ROUTE_CONFIG?.[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]
    const destKey = line.is_service ? 'service' : line.delivery_destination
    const destCfg = destKey ? DELIVERY_DESTINATION_CONFIG?.[destKey as keyof typeof DELIVERY_DESTINATION_CONFIG] : null
    const transitions = getValidTransitions(line.fulfilment_route, line.status, line.is_service, line.delivery_destination)
    const isCancelled = line.status === 'cancelled'
    const isLoading = loading === line.id
    const hasSerials = line.serial_numbers_received && line.serial_numbers_received.length > 0

    return (
      <tr key={line.id} className={`border-t border-slate-100 ${isCancelled ? 'opacity-50' : ''}`}>
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2">
            {line.products ? (
              <Link
                href={`/products/${line.products.id}`}
                className={`hover:text-blue-600 no-underline ${isCancelled ? 'line-through text-slate-400' : 'font-medium'}`}
              >
                {line.description}
              </Link>
            ) : (
              <span className={`${isCancelled ? 'line-through text-slate-400' : 'font-medium'}`}>
                {line.description}
              </span>
            )}
            {line.deal_reg_line_id && <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />}
            {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
          </div>
          {line.products && (
            <div className="text-xs text-slate-400">{line.products.sku}</div>
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
            {line.is_service ? (
              <Badge label="Service" color="#7c3aed" bg="#f5f3ff" />
            ) : routeCfg ? (
              <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
            ) : (
              <span className="text-xs text-slate-400">{line.fulfilment_route}</span>
            )}
        </td>
        <td className="px-5 py-2.5 text-slate-500">
          {line.status === 'pending' && !line.is_service && suppliers.length > 0 ? (() => {
            // Filter suppliers to those linked to this product; fall back to all if none linked
            const linkedIds = line.products
              ? productSuppliers.filter(ps => ps.product_id === line.products!.id).map(ps => ps.supplier_id)
              : []
            const filteredSuppliers = linkedIds.length > 0
              ? suppliers.filter(s => linkedIds.includes(s.id))
              : suppliers
            return (
              <select
                value={line.supplier_id || ''}
                onChange={(e) => handleSupplierChange(line.id, e.target.value)}
                disabled={changingSupplier === line.id}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-slate-400 bg-white max-w-[140px]"
              >
                <option value="">No supplier</option>
                {filteredSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )
          })() : (
            line.suppliers?.name || '\u2014'
          )}
        </td>
        <td className="px-5 py-2.5 text-right">
          {line.is_service ? (
            <span>{line.quantity}</span>
          ) : line.fulfilment_route === 'drop_ship' && (line.quantity_received > 0 || ['ordered', 'partial_received', 'received', 'delivered'].includes(line.status)) ? (
            <span>
              <span className={line.quantity_received < line.quantity ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                {line.quantity_received}
              </span>
              <span className="text-slate-400">/{line.quantity}</span>
            </span>
          ) : (
            <span>{line.quantity}</span>
          )}
        </td>
        <td className="px-5 py-2.5 text-right">{formatCurrency(line.buy_price)}</td>
        <td className="px-5 py-2.5 text-right">{formatCurrency(line.sell_price)}</td>
        <td className="px-5 py-2.5 text-right whitespace-nowrap">
          <span className={`font-medium ${mColor}`}>{lineMarginPct.toFixed(1)}%</span>
        </td>
        <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
        <td className="px-5 py-2.5">
          {destCfg && <Badge label={destCfg.label} color={destCfg.color} bg={destCfg.bg} />}
        </td>
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusCfg && (() => {
              const poInfo = poLineMap.get(line.id)
              const isPicked = line.status === 'picked'
              const tooltipParts: string[] = []
              if (isPicked && hasSerials) tooltipParts.push(`SN: ${line.serial_numbers_received.join(', ')}`)
              if (isPicked && poInfo) tooltipParts.push(poInfo.poNumber)
              const tooltip = tooltipParts.length > 0 ? tooltipParts.join(' · ') : undefined
              return <span title={tooltip} className={tooltip ? 'cursor-help' : undefined}><Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /></span>
            })()}
            {(() => {
              const poLabel = getPoAwareLabel(line)
              return poLabel ? <Badge label={poLabel.label} color={poLabel.color} bg={poLabel.bg} /> : null
            })()}
            {hasSerials && line.status !== 'picked' && (
              <span title={line.serial_numbers_received.join(', ')} className="cursor-help text-xs text-slate-400">
                SN:{line.serial_numbers_received.length}
              </span>
            )}
          </div>
          {(() => {
            if (line.status === 'picked') return null
            const poInfo = poLineMap.get(line.id)
            return poInfo ? (
              <Link
                href={`/purchase-orders/${poInfo.poId}`}
                className="text-[10px] text-blue-600 hover:underline no-underline mt-0.5 inline-block"
              >
                {poInfo.poNumber}
              </Link>
            ) : null
          })()}
        </td>
        <td className="px-5 py-2.5">
          <div className="flex gap-1 flex-wrap">
            {transitions.filter((t) => t !== 'partial_received' && t !== 'received').map((t) => (
              <button
                key={t}
                onClick={() => handleTransition(line.id, t)}
                disabled={isLoading}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  t === 'cancelled'
                    ? 'text-red-600 hover:bg-red-50 border border-red-200'
                    : 'text-blue-600 hover:bg-blue-50 border border-blue-200'
                } disabled:opacity-50`}
              >
                {isLoading ? '...' : ACTION_LABELS[t] || t}
              </button>
            ))}
          </div>
        </td>
      </tr>
    )
  }

  const tableHeaders = (
    <tr>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route</th>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margin</th>
      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dest.</th>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
    </tr>
  )

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Order Lines</h3>
        </div>

        {groupNames.map((groupName) => {
          const groupLines = lines
            .filter((l) => l.group_name === groupName)
            .sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div key={groupName}>
              <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
                <span className="text-sm font-semibold text-slate-700">{groupName}</span>
                <span className="ml-2 text-xs text-slate-400">({groupLines.length} items)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>{tableHeaders}</thead>
                  <tbody>
                    {groupLines.map(renderLineRow)}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {ungroupedLines.length > 0 && (
          <>
            {groupNames.length > 0 && (
              <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
                <span className="text-sm font-semibold text-slate-500">Ungrouped</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {groupNames.length === 0 && <thead>{tableHeaders}</thead>}
                <tbody>
                  {ungroupedLines.map(renderLineRow)}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer totals */}
        <div className="border-t border-gray-200 px-5 py-4">
          <div className="flex justify-end gap-8 text-sm">
            <div>
              <span className="text-slate-400 mr-2">Total (active):</span>
              <span className="font-semibold">{formatCurrency(totalSell)}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-2">Cost:</span>
              <span className="font-semibold">{formatCurrency(totalCost)}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-2">Margin:</span>
              <span className={`font-semibold ${getMarginColorFromPct(totalMarginPct, greenT, amberT)}`}>
                {formatCurrency(totalMargin)} ({totalMarginPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel line confirmation */}
      {cancelConfirm && (
        <Modal title="Cancel Line" onClose={() => setCancelConfirm(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to cancel the line <strong>{cancelConfirm.description}</strong>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setCancelConfirm(null)}>
              Keep Line
            </Button>
            <Button size="sm" variant="danger" onClick={confirmCancelLine} disabled={loading === cancelConfirm.lineId}>
              {loading === cancelConfirm.lineId ? 'Cancelling...' : 'Cancel Line'}
            </Button>
          </div>
        </Modal>
      )}

    </>
  )
}
