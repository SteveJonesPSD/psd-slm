import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { deriveSoDisplayStatus } from '@/lib/sales-orders'
import { getSalesOrders } from './actions'
import { OrdersTable } from './orders-table'

export default async function OrdersPage() {
  await requirePermission('sales_orders', 'view')
  const rawOrders = await getSalesOrders()

  // Compute derived status for each SO
  const orders = rawOrders.map((so) => ({
    ...so,
    derivedStatus: deriveSoDisplayStatus(so.sales_order_lines || []),
  }))

  // Stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const activeOrders = orders.filter((o) => !['fulfilled', 'invoiced', 'cancelled'].includes(o.derivedStatus))
  const totalActiveValue = activeOrders.reduce((sum: number, o) => {
    const lines = o.sales_order_lines || [] as { quantity: number; sell_price: number }[]
    return sum + lines.reduce((ls: number, l: { quantity: number; sell_price: number }) => ls + l.quantity * l.sell_price, 0)
  }, 0)
  const awaitingDelivery = orders.filter((o) =>
    ['in_progress', 'partially_fulfilled'].includes(o.derivedStatus)
  ).length
  const fulfilledThisMonth = orders.filter(
    (o) => o.derivedStatus === 'fulfilled' && new Date(o.created_at) >= monthStart
  ).length
  const invoicedThisMonth = orders.filter(
    (o) => o.derivedStatus === 'invoiced' && new Date(o.created_at) >= monthStart
  )
  const invoicedThisMonthValue = invoicedThisMonth.reduce((sum: number, o) => {
    const lines = o.sales_order_lines || [] as { quantity: number; sell_price: number }[]
    return sum + lines.reduce((ls: number, l: { quantity: number; sell_price: number }) => ls + l.quantity * l.sell_price, 0)
  }, 0)

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Manage orders from accepted quotes"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Orders" value={activeOrders.length} accent="#6366f1" />
        <StatCard label="Active Value" value={formatCurrency(totalActiveValue)} accent="#1e293b" />
        <StatCard label="Awaiting Delivery" value={awaitingDelivery} accent="#d97706" />
        <StatCard label="Fulfilled This Month" value={fulfilledThisMonth} accent="#059669" />
        <StatCard label="Invoiced This Month" value={invoicedThisMonth.length} accent="#8b5cf6" sub={formatCurrency(invoicedThisMonthValue)} />
      </div>

      <OrdersTable orders={orders} />
    </div>
  )
}
