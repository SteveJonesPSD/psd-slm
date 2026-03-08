'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { formatCurrency } from '@/lib/utils'
import { updateInvoice } from '../../actions'

interface SoLine {
  id: string
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  group_name: string | null
  group_sort: number
  sort_order: number
  quantity_invoiced: number
  product_id: string | null
}

interface InvoiceEditFormProps {
  invoiceId: string
  invoice: {
    contact_id: string | null
    payment_terms: number | null
    internal_notes: string | null
    vat_rate: number
    lines: {
      id: string
      sales_order_line_id: string | null
      description: string
      quantity: number
      unit_price: number
      unit_cost: number
      vat_rate: number
      sort_order: number
      group_name: string | null
    }[]
  }
  soData: {
    lines: SoLine[]
    contacts: { id: string; first_name: string; last_name: string }[]
    groupContacts?: { id: string; first_name: string; last_name: string; group_name: string }[]
    vat_rate: number
  }
}

interface LineSelection {
  selected: boolean
  invoiceQty: number
  maxQty: number
}

export function InvoiceEditForm({ invoiceId, invoice, soData }: InvoiceEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contactId, setContactId] = useState(invoice.contact_id || '')
  const [paymentTerms, setPaymentTerms] = useState(invoice.payment_terms || 30)
  const [internalNotes, setInternalNotes] = useState(invoice.internal_notes || '')

  // Build line selections — merge SO lines with existing invoice lines
  const [lineSelections, setLineSelections] = useState<Record<string, LineSelection>>(() => {
    const selections: Record<string, LineSelection> = {}
    const existingLineMap = new Map<string, { quantity: number }>()
    for (const il of invoice.lines) {
      if (il.sales_order_line_id) {
        existingLineMap.set(il.sales_order_line_id, { quantity: il.quantity })
      }
    }

    for (const soLine of soData.lines as SoLine[]) {
      // When editing, the current invoice's quantities are already counted in quantity_invoiced,
      // but we reversed them in the update action — so for max calculation, add back current invoice qty
      const currentInvQty = existingLineMap.get(soLine.id)?.quantity || 0
      const otherInvoiced = Math.max(0, (soLine.quantity_invoiced || 0) - currentInvQty)
      const maxQty = soLine.quantity - otherInvoiced

      selections[soLine.id] = {
        selected: existingLineMap.has(soLine.id),
        invoiceQty: currentInvQty || 0,
        maxQty,
      }
    }
    return selections
  })

  const allLines = soData.lines as SoLine[]
  const vatRate = invoice.vat_rate || soData.vat_rate || 20

  const selectedTotal = useMemo(() => {
    return allLines.reduce((sum, l) => {
      const sel = lineSelections[l.id]
      if (!sel?.selected || sel.invoiceQty <= 0) return sum
      return sum + sel.invoiceQty * l.sell_price
    }, 0)
  }, [allLines, lineSelections])

  const vatAmount = selectedTotal * (vatRate / 100)
  const grandTotal = selectedTotal + vatAmount

  const handleSave = async () => {
    setError('')
    setSaving(true)

    const lines = allLines
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

    if (lines.length === 0) {
      setError('At least one line item is required.')
      setSaving(false)
      return
    }

    const result = await updateInvoice({
      invoiceId,
      contactId: contactId || null,
      paymentTerms,
      internalNotes,
      lines,
    })

    setSaving(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      router.push(`/invoices/${invoiceId}`)
    }
  }

  return (
    <div>
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <SearchableSelect
          label="Contact"
          value={contactId}
          options={[
            ...soData.contacts.map((c) => ({
              value: c.id,
              label: `${c.first_name} ${c.last_name}`,
            })),
            ...(soData.groupContacts || []).map((c) => ({
              value: c.id,
              label: `${c.first_name} ${c.last_name} [${c.group_name}]`,
            })),
          ]}
          placeholder="Search contacts..."
          onChange={setContactId}
        />
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
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Internal Notes</label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
        />
      </div>

      {/* Line items */}
      <h4 className="text-sm font-semibold text-slate-900 mb-3">Line Items</h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
        <table className="w-full border-collapse text-sm min-w-[600px]">
          <thead>
            <tr>
              <th className="w-8 border-b-2 border-gray-200 bg-slate-50 px-5 py-3"></th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Max Qty</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invoice Qty</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell Price</th>
              <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {allLines.map((line) => {
              const sel = lineSelections[line.id]
              const lineTotal = sel?.selected && sel.invoiceQty > 0 ? sel.invoiceQty * line.sell_price : 0
              const noRemaining = sel?.maxQty <= 0

              return (
                <tr key={line.id} className={`border-b border-slate-100 ${noRemaining && !sel?.selected ? 'opacity-40' : ''}`}>
                  <td className="px-5 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={sel?.selected || false}
                      disabled={noRemaining && !sel?.selected}
                      onChange={() =>
                        setLineSelections((prev) => ({
                          ...prev,
                          [line.id]: { ...prev[line.id], selected: !prev[line.id]?.selected },
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">{line.description}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400 whitespace-nowrap">{sel?.maxQty ?? 0}</td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <input
                      type="number"
                      value={sel?.invoiceQty ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        setLineSelections((prev) => ({
                          ...prev,
                          [line.id]: { ...prev[line.id], invoiceQty: Math.min(val, prev[line.id]?.maxQty || 0) },
                        }))
                      }}
                      min={0}
                      max={sel?.maxQty || 0}
                      step="any"
                      disabled={!sel?.selected}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-slate-400 disabled:opacity-40"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(line.sell_price)}</td>
                  <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                    {sel?.selected ? formatCurrency(lineTotal) : '\u2014'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
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

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="default" onClick={() => router.push(`/invoices/${invoiceId}`)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
