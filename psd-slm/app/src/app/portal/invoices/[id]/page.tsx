import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalInvoiceDetail } from '@/lib/portal/invoices-actions'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_COLORS: Record<string, string> = {
  'Awaiting Payment': 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
  Void: 'bg-slate-100 text-slate-600',
  'Credit Note': 'bg-amber-100 text-amber-700',
}

export default async function PortalInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await requirePortalSession()
  const invoice = await getPortalInvoiceDetail(id, ctx)

  if (!invoice) notFound()

  // Group lines by group_name
  const groups = new Map<string, typeof invoice.lines>()
  for (const line of invoice.lines) {
    const key = line.groupName || '__ungrouped__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(line)
  }

  return (
    <div>
      <Link href="/portal/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Invoices
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{formatDate(invoice.sentAt || invoice.createdAt)}</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[invoice.portalStatus] || 'bg-slate-100 text-slate-600'}`}>
              {invoice.portalStatus}
            </span>
            {invoice.soNumber && (
              <Link href={`/portal/orders/${invoice.soId}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
                Order {invoice.soNumber}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">{formatCurrency(invoice.total)}</div>
            {invoice.paidAt && (
              <div className="text-xs text-green-600">Paid {formatDate(invoice.paidAt)}</div>
            )}
          </div>
          <a
            href={`/api/portal/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </a>
        </div>
      </div>

      {/* Invoice details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {invoice.dueDate && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-400 mb-1">Due Date</div>
            <div className={`text-sm font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-slate-900'}`}>
              {formatDate(invoice.dueDate)}
            </div>
          </div>
        )}
        {invoice.customerPo && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-400 mb-1">Your PO Reference</div>
            <div className="text-sm font-medium text-slate-900">{invoice.customerPo}</div>
          </div>
        )}
        {invoice.paymentTerms && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-400 mb-1">Payment Terms</div>
            <div className="text-sm font-medium text-slate-900">{invoice.paymentTerms}</div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 font-medium text-slate-600">Description</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-20">Qty</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-28">Unit Price</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 w-28">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...groups.entries()].map(([groupName, lines]) => (
              <>
                {groupName !== '__ungrouped__' && (
                  <tr key={`group-${groupName}`} className="bg-slate-50/50">
                    <td colSpan={4} className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {groupName}
                    </td>
                  </tr>
                )}
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3 text-slate-700">{l.description}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{l.quantity}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(l.unitPrice)}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(l.quantity * l.unitPrice)}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={3} className="px-5 py-2 text-right text-sm text-slate-500">Subtotal</td>
              <td className="px-5 py-2 text-right text-sm font-medium text-slate-900">{formatCurrency(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-5 py-2 text-right text-sm text-slate-500">VAT</td>
              <td className="px-5 py-2 text-right text-sm font-medium text-slate-900">{formatCurrency(invoice.vatAmount)}</td>
            </tr>
            <tr className="border-t border-slate-200">
              <td colSpan={3} className="px-5 py-3 text-right text-sm font-semibold text-slate-700">Total</td>
              <td className="px-5 py-3 text-right text-base font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
