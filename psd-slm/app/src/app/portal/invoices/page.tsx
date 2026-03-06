import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalInvoices } from '@/lib/portal/invoices-actions'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  'Awaiting Payment': 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
  Void: 'bg-slate-100 text-slate-600',
  'Credit Note': 'bg-amber-100 text-amber-700',
}

export default async function PortalInvoicesPage() {
  const ctx = await requirePortalSession()
  const invoices = await getPortalInvoices(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Your Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">View and download copies of your invoices</p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No invoices to display
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/portal/invoices/${inv.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[inv.portalStatus] || 'bg-slate-100 text-slate-600'}`}>
                      {inv.portalStatus}
                    </span>
                    {inv.invoiceType === 'credit_note' && (
                      <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
                        Credit Note
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>{formatDate(inv.sentAt || inv.createdAt)}</span>
                    {inv.dueDate && inv.status !== 'paid' && (
                      <span>Due {formatDate(inv.dueDate)}</span>
                    )}
                    {inv.soNumber && <span>Order {inv.soNumber}</span>}
                    {inv.customerPo && <span>PO: {inv.customerPo}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-900">{formatCurrency(inv.total)}</div>
                  {inv.paidAt && (
                    <div className="text-[11px] text-green-600 mt-0.5">Paid {formatDate(inv.paidAt)}</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
