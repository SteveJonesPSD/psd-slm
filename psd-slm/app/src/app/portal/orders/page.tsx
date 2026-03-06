import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalOrders } from '@/lib/portal/orders-actions'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  Processing: 'bg-slate-100 text-slate-600',
  Confirmed: 'bg-blue-100 text-blue-700',
  'Being Prepared': 'bg-amber-100 text-amber-700',
  'Partially Delivered': 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-green-100 text-green-700',
  Complete: 'bg-emerald-100 text-emerald-700',
}

export default async function PortalOrdersPage() {
  const ctx = await requirePortalSession()
  const orders = await getPortalOrders(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Your Orders</h1>
        <p className="mt-1 text-sm text-slate-500">Track the status of your orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No orders to display
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/portal/orders/${o.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{o.soNumber}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[o.portalStatus] || 'bg-slate-100 text-slate-600'}`}>
                      {o.portalStatus}
                    </span>
                  </div>
                  {o.notes && <p className="mt-0.5 text-xs text-slate-400 truncate">{o.notes}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>{formatDate(o.createdAt)}</span>
                    {o.quoteNumber && <span>From quote {o.quoteNumber}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-900">{formatCurrency(o.totalSell)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
