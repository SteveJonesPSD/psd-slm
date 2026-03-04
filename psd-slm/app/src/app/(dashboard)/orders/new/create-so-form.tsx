'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge, FULFILMENT_ROUTE_CONFIG, DELIVERY_DESTINATION_CONFIG } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor } from '@/lib/margin'
import { createSalesOrder } from '../actions'
import { isServiceItem } from '@/lib/sales-orders'
import type { Quote } from '@/types/database'

interface QuoteLine {
  id: string
  group_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: string
  is_optional: boolean
  requires_contract: boolean
  products: { name: string; sku: string; is_stocked: boolean; is_serialised: boolean | null; default_delivery_destination: string } | null
  suppliers: { name: string } | null
}

interface CreateSoFormProps {
  quote: Quote
  customer: { id: string; name: string; address_line1: string | null; address_line2: string | null; city: string | null; county: string | null; postcode: string | null } | null
  contact: { id: string; first_name: string; last_name: string; email: string | null } | null
  groups: { id: string; name: string; sort_order: number }[]
  lines: QuoteLine[]
  teamMembers: { id: string; first_name: string; last_name: string }[]
  currentUserId: string
}

interface LineOverride {
  fulfilment_route: string
  delivery_destination: string
}

export function CreateSoForm({ quote, customer, contact, groups, lines, teamMembers, currentUserId }: CreateSoFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [customerPo, setCustomerPo] = useState(quote.customer_po || '')
  const [assignedTo, setAssignedTo] = useState(quote.assigned_to || currentUserId)
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('')
  const [requiresInstall, setRequiresInstall] = useState(false)
  const [requestedInstallDate, setRequestedInstallDate] = useState('')
  const [installNotes, setInstallNotes] = useState('')
  const [notes, setNotes] = useState('')

  // Delivery address state
  const [addressLocked, setAddressLocked] = useState(true)
  const [deliveryAddress, setDeliveryAddress] = useState({
    line1: customer?.address_line1 || '',
    line2: customer?.address_line2 || '',
    city: customer?.city || '',
    postcode: customer?.postcode || '',
  })

  const customerAddress = {
    line1: customer?.address_line1 || '',
    line2: customer?.address_line2 || '',
    city: customer?.city || '',
    postcode: customer?.postcode || '',
  }
  const isAddressOverridden =
    deliveryAddress.line1 !== customerAddress.line1 ||
    deliveryAddress.line2 !== customerAddress.line2 ||
    deliveryAddress.city !== customerAddress.city ||
    deliveryAddress.postcode !== customerAddress.postcode

  const resetAddress = () => {
    setDeliveryAddress({ ...customerAddress })
    setAddressLocked(true)
  }

  // Line overrides — pre-populate from product default delivery destination
  const nonOptionalLines = lines.filter((l) => !l.is_optional)
  const [lineOverrides, setLineOverrides] = useState<Record<string, LineOverride>>(() => {
    const init: Record<string, LineOverride> = {}
    for (const l of nonOptionalLines) {
      const dest = l.products?.default_delivery_destination === 'customer_site' ? 'customer_site' : 'psd_office'
      init[l.id] = {
        fulfilment_route: dest === 'customer_site' ? 'drop_ship' : 'from_stock',
        delivery_destination: dest,
      }
    }
    return init
  })

  // Track whether user has confirmed direct-ship items
  const confirmedDirectShipRef = useRef(false)
  const [showDirectShipWarning, setShowDirectShipWarning] = useState(false)

  const updateLine = (lineId: string, field: keyof LineOverride, value: string) => {
    if (field === 'delivery_destination') confirmedDirectShipRef.current = false
    setLineOverrides((prev) => {
      const updated = { ...prev[lineId], [field]: value }
      // Warehouse destination forces Ship from Stock
      if (field === 'delivery_destination' && value === 'psd_office') {
        updated.fulfilment_route = 'from_stock'
      }
      return { ...prev, [lineId]: updated }
    })
  }

  const setAllFulfilmentRoute = (route: string) => {
    setLineOverrides((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        const line = nonOptionalLines.find((l) => l.id === key)
        if (line && isServiceItem(line.products)) continue
        // Only change fulfilment route on customer_site lines — warehouse is locked to from_stock
        if (next[key].delivery_destination === 'psd_office') continue
        next[key] = { ...next[key], fulfilment_route: route }
      }
      return next
    })
  }

  const setAllDestination = (dest: string) => {
    confirmedDirectShipRef.current = false
    setLineOverrides((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        const line = nonOptionalLines.find((l) => l.id === key)
        if (line && isServiceItem(line.products)) continue
        next[key] = {
          ...next[key],
          delivery_destination: dest,
          // Warehouse forces Ship from Stock
          ...(dest === 'psd_office' ? { fulfilment_route: 'from_stock' } : {}),
        }
      }
      return next
    })
  }

  // Compute totals
  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const totalCost = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const marginAmt = subtotal - totalCost
  const marginPct = subtotal > 0 ? (marginAmt / subtotal) * 100 : 0

  // Group lines
  const groupedLines = groups.map((g) => ({
    ...g,
    lines: nonOptionalLines.filter((l) => l.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order),
  }))
  const ungroupedLines = nonOptionalLines.filter((l) => !l.group_id)

  // Lines set to ship direct to customer site (non-service only)
  const directShipLines = nonOptionalLines.filter(
    (l) => !isServiceItem(l.products) && lineOverrides[l.id]?.delivery_destination === 'customer_site'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerPo.trim()) {
      setError('Customer PO number is required.')
      return
    }

    // Validate all non-service lines have a fulfilment route
    const missingRoutes = nonOptionalLines.filter(
      (l) => !isServiceItem(l.products) && !lineOverrides[l.id]?.fulfilment_route
    )
    if (missingRoutes.length > 0) {
      setError(`${missingRoutes.length} line(s) are missing a fulfilment route. Please select "Ship from Stock" or "Ship from Supplier" for all lines.`)
      return
    }

    // Warn about direct-ship items if not yet confirmed
    if (directShipLines.length > 0 && !confirmedDirectShipRef.current) {
      setShowDirectShipWarning(true)
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await createSalesOrder({
      quoteId: quote.id,
      customerPo: customerPo.trim(),
      assignedTo: assignedTo || null,
      requestedDeliveryDate: requestedDeliveryDate || null,
      requiresInstall,
      requestedInstallDate: requiresInstall && requestedInstallDate ? requestedInstallDate : null,
      installNotes: requiresInstall && installNotes.trim() ? installNotes.trim() : null,
      notes: notes.trim() || null,
      lineOverrides,
      ...(isAddressOverridden ? {
        deliveryAddress: {
          line1: deliveryAddress.line1 || null,
          line2: deliveryAddress.line2 || null,
          city: deliveryAddress.city || null,
          postcode: deliveryAddress.postcode || null,
        },
      } : {}),
    })

    setSubmitting(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/orders/${result.data.id}`)
    }
  }

  const renderLineRow = (line: QuoteLine) => {
    const override = lineOverrides[line.id]
    const lineTotal = line.quantity * line.sell_price
    const lineMarginPct = line.sell_price > 0
      ? ((line.sell_price - line.buy_price) / line.sell_price) * 100
      : 0
    const mColor = getMarginColor(line.buy_price, line.sell_price)
    const service = isServiceItem(line.products)

    return (
      <tr key={line.id} className="border-t border-slate-100">
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{line.description}</span>
            {service && <Badge label="Service" color="#7c3aed" bg="#f5f3ff" />}
          </div>
          {line.products && (
            <div className="text-xs text-slate-400">{line.products.sku}</div>
          )}
        </td>
        <td className="px-5 py-2.5 text-slate-500">{line.suppliers?.name || '\u2014'}</td>
        <td className="px-5 py-2.5 text-right">{line.quantity}</td>
        <td className="px-5 py-2.5 text-right">{formatCurrency(line.buy_price)}</td>
        <td className="px-5 py-2.5 text-right">{formatCurrency(line.sell_price)}</td>
        <td className="px-5 py-2.5 text-right whitespace-nowrap">
          <span className={`font-medium ${mColor}`}>{lineMarginPct.toFixed(1)}%</span>
        </td>
        <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
        <td className="px-5 py-2.5">
          {service ? (
            <span className="text-xs text-slate-400">N/A</span>
          ) : override?.delivery_destination === 'psd_office' ? (
            <span className="text-xs text-slate-500">Ship from Stock</span>
          ) : (
            <select
              value={override?.fulfilment_route ?? 'from_stock'}
              onChange={(e) => updateLine(line.id, 'fulfilment_route', e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
            >
              <option value="from_stock">Ship from Stock</option>
              <option value="drop_ship">Ship from Supplier</option>
            </select>
          )}
        </td>
        <td className="px-5 py-2.5">
          {service ? (
            <span className="text-xs text-slate-400">N/A</span>
          ) : (
            <select
              value={override?.delivery_destination || 'psd_office'}
              onChange={(e) => updateLine(line.id, 'delivery_destination', e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
            >
              <option value="psd_office">Warehouse</option>
              <option value="customer_site">Customer Site</option>
            </select>
          )}
        </td>
      </tr>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Section 1: Order Details */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h3 className="text-[15px] font-semibold mb-4">Order Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerPo}
              onChange={(e) => setCustomerPo(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. PO-12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Requested Delivery Date</label>
            <input
              type="date"
              value={requestedDeliveryDate}
              onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresInstall}
                onChange={(e) => setRequiresInstall(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Requires Installation</span>
            </label>
          </div>

          {requiresInstall && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requested Install Date</label>
                <input
                  type="date"
                  value={requestedInstallDate}
                  onChange={(e) => setRequestedInstallDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Install Notes</label>
                <input
                  type="text"
                  value={installNotes}
                  onChange={(e) => setInstallNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="e.g. Install in server room B"
                />
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div className={`rounded-xl border p-5 mb-6 ${isAddressOverridden ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Delivery Address</h3>
            {isAddressOverridden && <Badge label="Custom Address" color="#d97706" bg="#fffbeb" />}
          </div>
          <div className="flex items-center gap-2">
            {isAddressOverridden && (
              <button
                type="button"
                onClick={resetAddress}
                className="text-xs text-blue-600 hover:underline"
              >
                Reset to customer address
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddressLocked(!addressLocked)}
              className={`p-1.5 rounded-lg border transition-colors ${
                addressLocked
                  ? 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  : 'border-amber-300 bg-amber-50 text-amber-600'
              }`}
              title={addressLocked ? 'Unlock to edit address' : 'Lock address'}
            >
              {addressLocked ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address Line 1</label>
            <input
              type="text"
              value={deliveryAddress.line1}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, line1: e.target.value }))}
              disabled={addressLocked}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                addressLocked
                  ? 'bg-slate-50 border-slate-100 text-slate-600'
                  : 'bg-white border-slate-200 focus:border-slate-400'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address Line 2</label>
            <input
              type="text"
              value={deliveryAddress.line2}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, line2: e.target.value }))}
              disabled={addressLocked}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                addressLocked
                  ? 'bg-slate-50 border-slate-100 text-slate-600'
                  : 'bg-white border-slate-200 focus:border-slate-400'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
            <input
              type="text"
              value={deliveryAddress.city}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, city: e.target.value }))}
              disabled={addressLocked}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                addressLocked
                  ? 'bg-slate-50 border-slate-100 text-slate-600'
                  : 'bg-white border-slate-200 focus:border-slate-400'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Postcode</label>
            <input
              type="text"
              value={deliveryAddress.postcode}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, postcode: e.target.value }))}
              disabled={addressLocked}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                addressLocked
                  ? 'bg-slate-50 border-slate-100 text-slate-600'
                  : 'bg-white border-slate-200 focus:border-slate-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Lines */}
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">
            Order Lines
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({nonOptionalLines.length} items — optional lines excluded)
            </span>
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAllFulfilmentRoute('from_stock')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              All from Stock
            </button>
            <button
              type="button"
              onClick={() => setAllFulfilmentRoute('drop_ship')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              All from Supplier
            </button>
            <span className="border-l border-slate-200" />
            <button
              type="button"
              onClick={() => setAllDestination('psd_office')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              All to Warehouse
            </button>
            <button
              type="button"
              onClick={() => setAllDestination('customer_site')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              All to Customer Site
            </button>
          </div>
        </div>

        {groupedLines.map((group) => group.lines.length > 0 && (
          <div key={group.id}>
            <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
              <span className="text-sm font-semibold text-slate-700">{group.name}</span>
              <span className="ml-2 text-xs text-slate-400">({group.lines.length} items)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margin</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fulfilment</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map(renderLineRow)}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {ungroupedLines.length > 0 && (
          <>
            <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
              <span className="text-sm font-semibold text-slate-500">Ungrouped</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margin</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fulfilment</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Destination</th>
                  </tr>
                </thead>
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
              <span className="text-slate-400 mr-2">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-2">Margin:</span>
              <span className={`font-semibold ${marginPct >= 30 ? 'text-emerald-600' : marginPct >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                {formatCurrency(marginAmt)} ({marginPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="default"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Sales Order'}
        </Button>
      </div>

      {/* Direct Ship Warning Modal */}
      {showDirectShipWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-amber-200 shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-900">Direct Ship Confirmation</h3>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              One or more items on this order are set to ship direct to the customer site. Do you wish to continue?
            </p>
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 mb-4 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {directShipLines.map((l) => (
                  <li key={l.id} className="text-xs text-slate-700">
                    <span className="font-mono text-slate-500">{l.products?.sku || '—'}</span>
                    {' — '}
                    {l.description}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setShowDirectShipWarning(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  confirmedDirectShipRef.current = true
                  setShowDirectShipWarning(false)
                  // Re-trigger submit via the form
                  const form = document.querySelector('form')
                  form?.requestSubmit()
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
