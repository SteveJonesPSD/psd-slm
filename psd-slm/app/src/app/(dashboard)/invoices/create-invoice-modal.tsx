'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { getSalesOrderForInvoice, createInvoice } from './actions'
import { SearchableSelect } from '@/components/ui/form-fields'

interface CreateInvoiceModalProps {
  soId: string
  onClose: () => void
}

interface SoLineForInvoice {
  id: string
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  group_name: string | null
  group_sort: number
  sort_order: number
  status: string
  quantity_invoiced: number
  product_id: string | null
  products: { id: string; name: string; sku: string } | null
}

interface LineSelection {
  selected: boolean
  invoiceQty: number
  remaining: number
}

export function CreateInvoiceModal({ soId, onClose }: CreateInvoiceModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [soData, setSoData] = useState<Awaited<ReturnType<typeof getSalesOrderForInvoice>> | null>(null)
  const [lineSelections, setLineSelections] = useState<Record<string, LineSelection>>({})
  const [contactId, setContactId] = useState<string>('')
  const [paymentTerms, setPaymentTerms] = useState(30)
  const [invoiceType, setInvoiceType] = useState<'standard' | 'proforma'>('standard')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    getSalesOrderForInvoice(soId).then((data) => {
      setSoData(data)
      if (data) {
        setContactId(data.contact_id || '')
        const customerPaymentTerms = (data.customers as { payment_terms?: number } | null)?.payment_terms
        setPaymentTerms(customerPaymentTerms || 30)

        const selections: Record<string, LineSelection> = {}
        for (const line of data.lines as SoLineForInvoice[]) {
          const remaining = line.quantity - (line.quantity_invoiced || 0)
          selections[line.id] = {
            selected: remaining > 0,
            invoiceQty: remaining > 0 ? remaining : 0,
            remaining,
          }
        }
        setLineSelections(selections)
      }
      setLoading(false)
    })
  }, [soId])

  const allLines = (soData?.lines || []) as SoLineForInvoice[]
  // Only show lines that still have outstanding quantity to invoice
  const lines = allLines.filter((l) => l.quantity - (l.quantity_invoiced || 0) > 0)
  const vatRate = soData?.vat_rate ?? 20

  // Group lines by group_name
  const groupedLines = useMemo(() => {
    const groups: { name: string | null; lines: SoLineForInvoice[] }[] = []
    const groupMap = new Map<string | null, SoLineForInvoice[]>()

    for (const line of lines) {
      const key = line.group_name
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
        groups.push({ name: key, lines: groupMap.get(key)! })
      }
      groupMap.get(key)!.push(line)
    }

    return groups
  }, [lines])

  const selectedTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const sel = lineSelections[l.id]
      if (!sel?.selected || sel.invoiceQty <= 0) return sum
      return sum + sel.invoiceQty * l.sell_price
    }, 0)
  }, [lines, lineSelections])

  const vatAmount = selectedTotal * (vatRate / 100)
  const grandTotal = selectedTotal + vatAmount
  const hasSelectedLines = lines.some((l) => lineSelections[l.id]?.selected && lineSelections[l.id]?.invoiceQty > 0)

  const handleFullInvoice = () => {
    const updated: Record<string, LineSelection> = {}
    for (const line of lines) {
      const remaining = line.quantity - (line.quantity_invoiced || 0)
      updated[line.id] = {
        selected: remaining > 0,
        invoiceQty: remaining > 0 ? remaining : 0,
        remaining,
      }
    }
    setLineSelections(updated)
  }

  const handleToggleLine = (lineId: string) => {
    setLineSelections((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        selected: !prev[lineId]?.selected,
      },
    }))
  }

  const handleQtyChange = (lineId: string, qty: number) => {
    setLineSelections((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        invoiceQty: qty,
      },
    }))
  }

  const handleCreate = async () => {
    setError('')
    setSaving(true)

    const invoiceLines = lines
      .filter((l) => lineSelections[l.id]?.selected && lineSelections[l.id]?.invoiceQty > 0)
      .map((l, idx) => ({
        salesOrderLineId: l.id,
        quantity: lineSelections[l.id].invoiceQty,
        unitPrice: l.sell_price,
        unitCost: l.buy_price,
        vatRate,
        description: l.description,
        productId: l.product_id,
        sortOrder: idx,
        groupName: l.group_name,
      }))

    // Validate
    for (const line of invoiceLines) {
      const sel = lineSelections[line.salesOrderLineId]
      if (line.quantity > sel.remaining + 0.001) {
        setError(`Quantity exceeds remaining for "${line.description}".`)
        setSaving(false)
        return
      }
    }

    const result = await createInvoice({
      salesOrderId: soId,
      contactId: contactId || null,
      paymentTerms,
      invoiceType,
      internalNotes,
      lines: invoiceLines,
    })

    setSaving(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else if ('invoiceId' in result) {
      router.push(`/invoices/${result.invoiceId}`)
    }
  }

  if (loading) {
    return (
      <Modal title="Create Invoice" onClose={onClose} width={900}>
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-slate-400">Loading sales order data...</div>
        </div>
      </Modal>
    )
  }

  if (!soData) {
    return (
      <Modal title="Create Invoice" onClose={onClose}>
        <div className="text-sm text-red-600">Sales order not found.</div>
      </Modal>
    )
  }

  return (
    <Modal title="Create Invoice" onClose={onClose} width={960}>
      {/* Header section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Company</label>
          <div className="text-sm font-medium text-slate-700">{(soData.customers as { name: string } | null)?.name || '\u2014'}</div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Contact</label>
          <SearchableSelect
            value={contactId}
            options={(soData.contacts || []).map((c: { id: string; first_name: string; last_name: string }) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
            placeholder="Search contacts..."
            onChange={setContactId}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Customer PO</label>
          <div className="text-sm text-slate-700">{soData.customer_po || '\u2014'}</div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Brand</label>
          <div className="text-sm text-slate-700">{(soData.brand as { name: string } | null)?.name || 'Default'}</div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Payment Terms (days)</label>
          <input
            type="number"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(parseInt(e.target.value) || 30)}
            min={0}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Invoice Type</label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as 'standard' | 'proforma')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="standard">Standard</option>
            <option value="proforma">Proforma</option>
          </select>
        </div>
      </div>

      {/* Internal Notes */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Internal Notes</label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
          placeholder="Internal notes (not shown on invoice)"
        />
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900">Line Items</h4>
        <Button size="sm" variant="blue" onClick={handleFullInvoice}>
          Full Invoice
        </Button>
      </div>

      {/* Line selection table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
        <table className="w-full border-collapse text-sm min-w-[700px]">
          <thead>
            <tr>
              <th className="w-8 border-b-2 border-gray-200 bg-slate-50 px-5 py-3"></th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">SO Qty</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Invoiced</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Remaining</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Invoice Qty</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Sell Price</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedLines.map((group) => (
              <GroupRows
                key={group.name || '__ungrouped'}
                groupName={group.name}
                lines={group.lines}
                lineSelections={lineSelections}
                onToggle={handleToggleLine}
                onQtyChange={handleQtyChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="w-64 space-y-1">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span>{formatCurrency(selectedTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>VAT ({vatRate}%)</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          variant="primary"
          onClick={handleCreate}
          disabled={saving || !hasSelectedLines}
        >
          {saving ? 'Creating...' : 'Create Invoice'}
        </Button>
      </div>
    </Modal>
  )
}

function GroupRows({
  groupName,
  lines,
  lineSelections,
  onToggle,
  onQtyChange,
}: {
  groupName: string | null
  lines: SoLineForInvoice[]
  lineSelections: Record<string, LineSelection>
  onToggle: (id: string) => void
  onQtyChange: (id: string, qty: number) => void
}) {
  return (
    <>
      {groupName && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {groupName}
          </td>
        </tr>
      )}
      {lines.map((line) => {
        const sel = lineSelections[line.id]
        const remaining = sel?.remaining ?? 0
        const isFullyInvoiced = remaining <= 0
        const lineTotal = (sel?.selected && sel.invoiceQty > 0 ? sel.invoiceQty * line.sell_price : 0)

        return (
          <tr
            key={line.id}
            className={`border-b border-slate-100 ${isFullyInvoiced ? 'opacity-40' : ''}`}
          >
            <td className="px-5 py-2.5 text-center">
              <input
                type="checkbox"
                checked={sel?.selected && !isFullyInvoiced}
                disabled={isFullyInvoiced}
                onChange={() => onToggle(line.id)}
                className="rounded border-slate-300"
              />
            </td>
            <td className="px-5 py-2.5 text-slate-700">{line.description}</td>
            <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">{line.quantity}</td>
            <td className="px-5 py-2.5 text-right text-slate-400 whitespace-nowrap">{line.quantity_invoiced || 0}</td>
            <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">{remaining}</td>
            <td className="px-5 py-2.5 text-right whitespace-nowrap">
              {isFullyInvoiced ? (
                <span className="text-slate-400">\u2014</span>
              ) : (
                <input
                  type="number"
                  value={sel?.invoiceQty ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0
                    onQtyChange(line.id, Math.min(val, remaining))
                  }}
                  min={0}
                  max={remaining}
                  step="any"
                  disabled={!sel?.selected}
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-slate-400 disabled:opacity-40"
                />
              )}
            </td>
            <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(line.sell_price)}</td>
            <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
              {sel?.selected && !isFullyInvoiced ? formatCurrency(lineTotal) : '\u2014'}
            </td>
          </tr>
        )
      })}
    </>
  )
}
