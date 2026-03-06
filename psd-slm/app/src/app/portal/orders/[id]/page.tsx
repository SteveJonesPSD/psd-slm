import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalOrderDetail } from '@/lib/portal/orders-actions'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PortalOrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await requirePortalSession()
  const order = await getPortalOrderDetail(id, ctx)

  if (!order) notFound()

  return (
    <div>
      <Link href="/portal/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{order.soNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{formatDate(order.createdAt)}</span>
            <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-medium">
              {order.portalStatus}
            </span>
            {order.quoteNumber && (
              <Link href={`/portal/quotes/${order.quoteId}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
                From {order.quoteNumber}
              </Link>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-900">{formatCurrency(order.totalSell)}</div>
        </div>
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
              <th className="text-center px-5 py-3 font-medium text-slate-600 w-28">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 text-slate-700">{l.description}</td>
                <td className="px-5 py-3 text-right text-slate-600">{l.quantity}</td>
                <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(l.sellPrice)}</td>
                <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(l.quantity * l.sellPrice)}</td>
                <td className="px-5 py-3 text-center">
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.deliveryAddress && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Delivery Address</h3>
          <p className="text-sm text-slate-600">{order.deliveryAddress}</p>
        </div>
      )}
    </div>
  )
}
