'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  createSupportContractInvoice,
  bulkCreateSupportInvoices,
} from './actions'
import type { SupportContractInvoicingRow } from './actions'

interface InvoicingTabProps {
  contracts: SupportContractInvoicingRow[]
}

export function InvoicingTab({ contracts }: InvoicingTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showDueOnly, setShowDueOnly] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [invoiceModal, setInvoiceModal] = useState<SupportContractInvoicingRow | null>(null)

  const filtered = contracts.filter(c => {
    if (showDueOnly && !c.invoice_due) return false
    if (search) {
      const s = search.toLowerCase()
      if (!c.contract_number.toLowerCase().includes(s) && !c.customer_name.toLowerCase().includes(s)) return false
    }
    return true
  })

  const dueCount = contracts.filter(c => c.invoice_due && !c.has_draft_invoice).length

  const handleBulkCreate = async () => {
    setBulkLoading(true)
    const result = await bulkCreateSupportInvoices()
    setBulkLoading(false)
    if (result.errors.length > 0) {
      setToast(`${result.created} invoices created. ${result.errors.length} errors.`)
    } else {
      setToast(`${result.created} invoice${result.created !== 1 ? 's' : ''} created as drafts.${result.skipped > 0 ? ` ${result.skipped} skipped (no lines).` : ''}`)
    }
    router.refresh()
    setTimeout(() => setToast(null), 5000)
  }

  const columns: Column<SupportContractInvoicingRow>[] = [
    {
      key: 'contract_number',
      label: 'Contract',
      nowrap: true,
      render: (r) => (
        <Link href={`/contracts/${r.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800 no-underline">
          {r.contract_number}
        </Link>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (r) => r.customer_name,
    },
    {
      key: 'contract_type_name',
      label: 'Type',
      nowrap: true,
      render: (r) => r.contract_type_name,
    },
    {
      key: 'start_date',
      label: 'Start Date',
      nowrap: true,
      render: (r) => new Date(r.start_date).toLocaleDateString('en-GB'),
    },
    {
      key: 'last_invoiced_date',
      label: 'Last Invoiced',
      nowrap: true,
      render: (r) => r.last_invoiced_date
        ? new Date(r.last_invoiced_date).toLocaleDateString('en-GB')
        : <span className="text-slate-300">Never</span>,
    },
    {
      key: 'invoice_due',
      label: 'Invoice Due',
      nowrap: true,
      align: 'center',
      render: (r) => {
        if (r.has_draft_invoice) {
          return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Draft exists</span>
        }
        return r.invoice_due
          ? <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Yes</span>
          : <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">No</span>
      },
    },
    {
      key: 'annual_value',
      label: 'Annual Value',
      nowrap: true,
      align: 'right',
      render: (r) => <span className="font-semibold">{formatCurrency(r.annual_value)}</span>,
    },
    {
      key: 'actions',
      label: '',
      nowrap: true,
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          variant="primary"
          onClick={(e) => { e.stopPropagation(); setInvoiceModal(r) }}
          disabled={r.has_draft_invoice}
        >
          Create Invoice
        </Button>
      ),
    },
  ]

  return (
    <div>
      {toast && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search contracts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showDueOnly}
            onChange={(e) => setShowDueOnly(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
          />
          Due only
        </label>
        <div className="flex-1" />
        {dueCount > 0 && (
          <Button
            size="sm"
            variant="success"
            onClick={handleBulkCreate}
            disabled={bulkLoading}
          >
            {bulkLoading ? 'Creating...' : `Create All Due Invoices (${dueCount})`}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No active support contracts."
      />

      {invoiceModal && (
        <SupportInvoiceModal
          contract={invoiceModal}
          onClose={() => setInvoiceModal(null)}
          onCreated={(invoiceNumber) => {
            setInvoiceModal(null)
            setToast(`Draft invoice ${invoiceNumber} created.`)
            router.refresh()
            setTimeout(() => setToast(null), 5000)
          }}
        />
      )}
    </div>
  )
}

function SupportInvoiceModal({
  contract,
  onClose,
  onCreated,
}: {
  contract: SupportContractInvoicingRow
  onClose: () => void
  onCreated: (invoiceNumber: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Calculate default invoice date
  const getDefaultInvoiceDate = () => {
    if (contract.next_invoice_date) return contract.next_invoice_date
    return new Date().toISOString().split('T')[0]
  }

  const [invoiceDate, setInvoiceDate] = useState(getDefaultInvoiceDate)
  const [lines, setLines] = useState(
    contract.lines.map(l => ({
      description: l.description,
      unit_price: Number(l.unit_price_annual) || 0,
      vat_rate: 20,
      quantity: Number(l.quantity) || 1,
    }))
  )

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  const vatAmount = Math.round(subtotal * 0.2 * 100) / 100
  const total = Math.round((subtotal + vatAmount) * 100) / 100

  const handleCreate = async () => {
    if (lines.length === 0) {
      setError('At least one line is required')
      return
    }
    setSaving(true)
    setError('')

    const result = await createSupportContractInvoice(contract.id, invoiceDate, lines)
    setSaving(false)

    if (!result.success) {
      setError(result.error || 'Failed to create invoice')
    } else {
      onCreated(result.invoiceNumber || '')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Create Support Contract Invoice</h3>
        <p className="text-sm text-slate-500 mb-4">
          {contract.contract_number} &mdash; {contract.customer_name}
        </p>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            {contract.billing_cycle_type === 'fixed_date'
              ? `Billing month: ${contract.billing_month === 4 ? 'April' : 'September'}`
              : 'Billed on contract start date anniversary'}
          </p>
        </div>

        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 px-3 text-right w-32">Sell Price (£/yr)</th>
                <th className="py-2 px-3 text-center w-20">VAT %</th>
                <th className="py-2 px-3 text-right w-24">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-3 text-slate-700">{line.description}</td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unit_price}
                      onChange={(e) => {
                        const updated = [...lines]
                        updated[idx] = { ...updated[idx], unit_price: Number(e.target.value) }
                        setLines(updated)
                      }}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right focus:border-indigo-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-center text-slate-500">{line.vat_rate}%</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-700">
                    {formatCurrency(line.quantity * line.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>VAT (20%)</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 text-base pt-1">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Draft Invoice'}
          </Button>
        </div>
      </div>
    </div>
  )
}
