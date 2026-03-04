import Link from 'next/link'
import { requirePermission, hasPermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { getPurchaseOrders } from './actions'
import { PurchaseOrdersTable } from './purchase-orders-table'

export default async function PurchaseOrdersPage() {
  const user = await requirePermission('purchase_orders', 'view')
  const orders = await getPurchaseOrders()
  const canCreate = hasPermission(user, 'purchase_orders', 'create')

  // Stats
  const draftCount = orders.filter((po) => po.status === 'draft').length
  const outstandingCount = orders.filter((po) => ['sent', 'acknowledged'].includes(po.status)).length
  const partialCount = orders.filter((po) => po.status === 'partially_received').length

  const totalOnOrder = orders
    .filter((po) => ['sent', 'acknowledged', 'partially_received'].includes(po.status))
    .reduce((sum, po) => {
      const lineTotal = (po.purchase_order_lines || []).reduce(
        (s: number, l: { quantity: number; unit_cost: number; status: string }) =>
          l.status !== 'cancelled' ? s + l.quantity * l.unit_cost : s,
        0
      )
      return sum + lineTotal
    }, 0)

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={`${orders.length} purchase order${orders.length !== 1 ? 's' : ''}`}
        actions={canCreate ? (
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 no-underline"
          >
            + New Stock Order
          </Link>
        ) : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Draft" value={draftCount} accent="#6b7280" />
        <StatCard label="Outstanding" value={outstandingCount} accent="#2563eb" />
        <StatCard label="Partially Received" value={partialCount} accent="#d97706" />
        <StatCard label="Total on Order" value={formatCurrency(totalOnOrder)} accent="#6366f1" />
      </div>

      <PurchaseOrdersTable orders={orders} />
    </div>
  )
}
