'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, SO_LINE_STATUS_CONFIG, FULFILMENT_ROUTE_CONFIG, DELIVERY_DESTINATION_CONFIG, PO_STATUS_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor } from '@/lib/margin'
import { getValidTransitions } from '@/lib/sales-orders'
import { updateLineStatus, receiveGoods, updateSoLineSupplier, updateSoCustomerPo } from '../actions'
import { generatePurchaseOrders } from '../../purchase-orders/actions'

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

interface SoLinesTableProps {
  lines: SoLine[]
  soId: string
  suppliers?: SupplierOption[]
  purchaseOrders?: PoRef[]
  customerPo?: string | null
}

const ACTION_LABELS: Record<string, string> = {
  picked: 'Mark Picked',
  ordered: 'Mark Ordered',
  partial_received: 'Partial Received',
  received: 'Mark Received',
  delivered: 'Mark Delivered',
  cancelled: 'Cancel Line',
}

export function SoLinesTable({ lines, soId, suppliers = [], purchaseOrders = [], customerPo }: SoLinesTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [changingSupplier, setChangingSupplier] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<{ lineId: string; description: string } | null>(null)
  const [receiveModal, setReceiveModal] = useState<SoLine | null>(null)
  const [receiveQty, setReceiveQty] = useState(1)
  const [receiveSerials, setReceiveSerials] = useState('')
  const [receiveError, setReceiveError] = useState<string | null>(null)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showPoNumberModal, setShowPoNumberModal] = useState(false)
  const [poNumberInput, setPoNumberInput] = useState('')
  const [savingPoNumber, setSavingPoNumber] = useState(false)

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
    if (poInfo.poLineStatus === 'received') {
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

  const openReceiveModal = (line: SoLine) => {
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

    const requiresSerials = receiveModal.products?.is_serialised === true
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
    }

    setLoading(receiveModal.id)
    const result = await receiveGoods({
      soId,
      lineId: receiveModal.id,
      quantityReceived: receiveQty,
      serialNumbers,
    })
    setLoading(null)

    if ('error' in result && result.error) {
      setReceiveError(result.error)
    } else {
      setReceiveModal(null)
      router.refresh()
    }
  }

  // PO generation logic
  const isEligibleForPo = (line: SoLine) =>
    line.status === 'pending' && !line.is_service && line.supplier_id

  const eligibleLines = lines.filter(isEligibleForPo)
  const selectedCount = selectedLines.size
  const hasEligible = eligibleLines.length > 0

  const toggleLineSelection = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const toggleAllEligible = () => {
    if (selectedLines.size === eligibleLines.length) {
      setSelectedLines(new Set())
    } else {
      setSelectedLines(new Set(eligibleLines.map((l) => l.id)))
    }
  }

  // Group eligible lines by supplier + destination for preview
  const getPreviewBatches = (lineIds: string[]) => {
    const selected = lines.filter((l) => lineIds.includes(l.id))
    const groups = new Map<string, { supplierName: string; destination: string; lines: SoLine[] }>()
    for (const line of selected) {
      const dest = line.delivery_destination || 'psd_office'
      const key = `${line.supplier_id}__${dest}`
      if (!groups.has(key)) {
        groups.set(key, {
          supplierName: line.suppliers?.name || 'Unknown',
          destination: dest,
          lines: [],
        })
      }
      groups.get(key)!.lines.push(line)
    }
    return Array.from(groups.values())
  }

  const handleGenerateAll = () => {
    setSelectedLines(new Set(eligibleLines.map((l) => l.id)))
    if (!customerPo) {
      setShowPoNumberModal(true)
    } else {
      setShowPreview(true)
    }
  }

  const handleGenerateSelected = () => {
    if (!customerPo) {
      setShowPoNumberModal(true)
    } else {
      setShowPreview(true)
    }
  }

  const handleSavePoNumberAndContinue = async () => {
    if (!poNumberInput.trim()) return
    setSavingPoNumber(true)
    const result = await updateSoCustomerPo(soId, poNumberInput.trim())
    setSavingPoNumber(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowPoNumberModal(false)
      setShowPreview(true)
      router.refresh()
    }
  }

  const handleConfirmGenerate = async () => {
    setGenerating(true)
    const result = await generatePurchaseOrders({
      soId,
      lineIds: Array.from(selectedLines),
    })
    setGenerating(false)
    setShowPreview(false)
    setSelectedLines(new Set())

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
    const mColor = getMarginColor(line.buy_price, line.sell_price)
    const statusCfg = SO_LINE_STATUS_CONFIG[line.status]
    const routeCfg = FULFILMENT_ROUTE_CONFIG?.[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]
    const destKey = line.is_service ? 'service' : line.delivery_destination
    const destCfg = destKey ? DELIVERY_DESTINATION_CONFIG?.[destKey as keyof typeof DELIVERY_DESTINATION_CONFIG] : null
    const transitions = getValidTransitions(line.fulfilment_route, line.status, line.is_service, line.delivery_destination)
    const isCancelled = line.status === 'cancelled'
    const isLoading = loading === line.id
    const canReceive = !line.is_service && ['ordered', 'partial_received'].includes(line.status)
    const hasSerials = line.serial_numbers_received && line.serial_numbers_received.length > 0
    const eligible = isEligibleForPo(line)
    const noSupplierWarning = line.status === 'pending' && !line.is_service && !line.supplier_id

    return (
      <tr key={line.id} className={`border-t border-slate-100 ${isCancelled ? 'opacity-50' : ''}`}>
        {hasEligible && (
          <td className="pl-3 py-2.5 w-8">
            {eligible ? (
              <input
                type="checkbox"
                checked={selectedLines.has(line.id)}
                onChange={() => toggleLineSelection(line.id)}
                className="rounded border-slate-300"
              />
            ) : noSupplierWarning ? (
              <span title="Assign a supplier to generate a PO" className="text-amber-500 text-xs cursor-help">!</span>
            ) : null}
          </td>
        )}
        <td className={`${hasEligible ? 'px-2' : 'px-5'} py-2.5`}>
          <div className="flex items-center gap-2">
            <span className={`${isCancelled ? 'line-through text-slate-400' : 'font-medium'}`}>
              {line.description}
            </span>
            {line.deal_reg_line_id && <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />}
            {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
          </div>
          {line.products && (
            <div className="text-xs text-slate-400">{line.products.sku}</div>
          )}
        </td>
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            {line.is_service ? (
              <Badge label="Service" color="#7c3aed" bg="#f5f3ff" />
            ) : routeCfg ? (
              <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
            ) : (
              <span className="text-xs text-slate-400">{line.fulfilment_route}</span>
            )}
          </div>
        </td>
        <td className="px-5 py-2.5 text-slate-500">
          {line.status === 'pending' && !line.is_service && suppliers.length > 0 ? (
            <select
              value={line.supplier_id || ''}
              onChange={(e) => handleSupplierChange(line.id, e.target.value)}
              disabled={changingSupplier === line.id}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-slate-400 bg-white max-w-[140px]"
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
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
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {(() => {
              const poLabel = getPoAwareLabel(line)
              return poLabel ? <Badge label={poLabel.label} color={poLabel.color} bg={poLabel.bg} /> : null
            })()}
            {hasSerials && (
              <span title={line.serial_numbers_received.join(', ')} className="cursor-help text-xs text-slate-400">
                SN:{line.serial_numbers_received.length}
              </span>
            )}
          </div>
          {(() => {
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
            {canReceive && (
              <button
                onClick={() => openReceiveModal(line)}
                disabled={isLoading}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-teal-600 hover:bg-teal-50 border border-teal-200 transition-colors disabled:opacity-50"
              >
                Receive Goods
              </button>
            )}
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
      {hasEligible && <th className="pl-3 py-3 w-8"><input type="checkbox" checked={selectedLines.size === eligibleLines.length && eligibleLines.length > 0} onChange={toggleAllEligible} className="rounded border-slate-300" /></th>}
      <th className={`${hasEligible ? 'px-2' : 'px-5'} py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>Description</th>
      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route</th>
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

  const previewBatches = showPreview ? getPreviewBatches(Array.from(selectedLines)) : []

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        {/* Header with PO generation toolbar */}
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Order Lines</h3>
          {hasEligible && (
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Button size="sm" variant="blue" onClick={handleGenerateSelected} disabled={generating}>
                  Generate POs for Selected ({selectedCount})
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={handleGenerateAll} disabled={generating}>
                Generate All POs ({eligibleLines.length})
              </Button>
            </div>
          )}
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
              <span className={`font-semibold ${totalMarginPct >= 30 ? 'text-emerald-600' : totalMarginPct >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                {formatCurrency(totalMargin)} ({totalMarginPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PO generation preview modal */}
      {showPreview && (
        <Modal title="Generate Purchase Orders" onClose={() => setShowPreview(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              The following purchase orders will be created:
            </p>
            <div className="space-y-2">
              {previewBatches.map((batch, i) => {
                const total = batch.lines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
                return (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{batch.supplierName}</span>
                        <span className="mx-2 text-slate-400">&rarr;</span>
                        <Badge
                          label={batch.destination === 'psd_office' ? 'Warehouse' : 'Customer Site'}
                          color={batch.destination === 'psd_office' ? '#d97706' : '#2563eb'}
                          bg={batch.destination === 'psd_office' ? '#fffbeb' : '#eff6ff'}
                        />
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(total)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {batch.lines.length} line{batch.lines.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="default" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleConfirmGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Confirm & Generate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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

      {/* Receive Goods modal */}
      {/* Customer PO Number Required modal */}
      {showPoNumberModal && (
        <Modal title="Customer PO Number Required" onClose={() => setShowPoNumberModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            A customer PO number is required before generating purchase orders. Please enter it below.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer PO Number
            </label>
            <input
              type="text"
              value={poNumberInput}
              onChange={(e) => setPoNumberInput(e.target.value)}
              placeholder="e.g. PO-12345"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowPoNumberModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSavePoNumberAndContinue}
              disabled={savingPoNumber || !poNumberInput.trim()}
            >
              {savingPoNumber ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </Modal>
      )}

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
                Quantity Receiving
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

            {receiveModal.products?.is_serialised && (
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
