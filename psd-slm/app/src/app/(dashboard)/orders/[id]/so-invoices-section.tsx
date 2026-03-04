'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, INVOICE_STATUS_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreateInvoiceModal } from '../../invoices/create-invoice-modal'

interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  effectiveStatus: string
  invoice_type: string
  total: number
  paid_at: string | null
  created_at: string
  due_date: string | null
}

interface SoInvoicesSectionProps {
  soId: string
  invoices: InvoiceRow[]
  derivedStatus: string
  allLinesFullyInvoiced: boolean
  totalInvoiced: number
  totalSoValue: number
  goodsReceivedStatus: 'none' | 'partial' | 'all'
}

export function SoInvoicesSection({
  soId,
  invoices,
  derivedStatus,
  allLinesFullyInvoiced,
  totalInvoiced,
  totalSoValue,
  goodsReceivedStatus,
}: SoInvoicesSectionProps) {
  const { hasPermission } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const canCreate = hasPermission('invoices', 'create')
  const statusAllowsInvoice = ['confirmed', 'in_progress', 'partially_fulfilled', 'fulfilled', 'part_invoiced'].includes(derivedStatus)
  const noGoodsReceived = goodsReceivedStatus === 'none'
  const canCreateInvoice = canCreate && statusAllowsInvoice && !allLinesFullyInvoiced && !noGoodsReceived

  const totalOutstanding = invoices
    .filter((i) => ['sent', 'overdue'].includes(i.effectiveStatus))
    .reduce((sum, i) => sum + i.total, 0)

  const progressPct = totalSoValue > 0 ? Math.min(100, (totalInvoiced / totalSoValue) * 100) : 0

  // Determine button label
  const hasExistingInvoices = invoices.filter((i) => i.invoice_type !== 'credit_note').length > 0
  const buttonLabel = allLinesFullyInvoiced
    ? 'Fully Invoiced'
    : noGoodsReceived
    ? 'Create Invoice'
    : goodsReceivedStatus === 'partial'
    ? 'Part Invoice'
    : hasExistingInvoices
    ? 'Create Partial Invoice'
    : 'Create Invoice'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold">
          Invoices {invoices.length > 0 && <span className="text-slate-400">({invoices.length})</span>}
        </h3>
        {canCreate && (
          <div className="relative group">
            <Button
              size="sm"
              variant={canCreateInvoice ? 'primary' : 'default'}
              onClick={() => setShowCreateModal(true)}
              disabled={!canCreateInvoice}
            >
              {buttonLabel}
            </Button>
            {noGoodsReceived && statusAllowsInvoice && !allLinesFullyInvoiced && (
              <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block whitespace-nowrap rounded bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg">
                No goods have been received yet
              </div>
            )}
          </div>
        )}
      </div>

      {invoices.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
            <table className="w-full border-collapse text-sm min-w-[500px]">
              <thead>
                <tr>
                  <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invoice #</th>
                  <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const cfg = INVOICE_STATUS_CONFIG[inv.effectiveStatus]
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link href={`/invoices/${inv.id}`} className="font-semibold text-blue-600 hover:underline no-underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5">
                        {cfg && <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(inv.created_at)}</td>
                      <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                        <span className={inv.total < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(inv.total)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {inv.paid_at ? (
                          <span className="text-green-600">&#10003;</span>
                        ) : (
                          <span className="text-slate-300">\u2014</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Total Invoiced:</span>{' '}
              <span className="font-semibold">{formatCurrency(totalInvoiced)}</span>
            </div>
            <div>
              <span className="text-slate-500">Outstanding:</span>{' '}
              <span className="font-semibold text-amber-600">{formatCurrency(totalOutstanding)}</span>
            </div>
            <div>
              <span className="text-slate-500">Progress:</span>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">{progressPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">No invoices yet.</p>
      )}

      {showCreateModal && (
        <CreateInvoiceModal soId={soId} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
