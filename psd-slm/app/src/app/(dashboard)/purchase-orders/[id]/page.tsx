import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, PO_STATUS_CONFIG, DELIVERY_DESTINATION_CONFIG, PURCHASE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getPurchaseOrder } from '../actions'
import { PoDetailActions } from './po-detail-actions'
import { PoLinesTable } from './po-lines-table'
import { PoDeliveryInfo } from './po-delivery-info'
import { PoActivity } from './po-activity'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('purchase_orders', 'view')

  const po = await getPurchaseOrder(id)
  if (!po) notFound()

  const statusCfg = PO_STATUS_CONFIG[po.status]
  const isStockOrder = po.purchase_type === 'stock_order'

  // Calculate totals
  const lines = po.lines || []
  const activeLines = lines.filter((l: { status: string }) => l.status !== 'cancelled')
  const goodsTotal = activeLines.reduce((sum: number, l: { quantity: number; unit_cost: number }) => sum + l.quantity * l.unit_cost, 0)
  const deliveryCost = po.delivery_cost || 0
  const poTotal = goodsTotal + deliveryCost

  // Quoted cost (from SO lines — only for customer orders)
  const quotedCost = isStockOrder ? 0 : activeLines.reduce((sum: number, l: { quantity: number; sales_order_lines: { buy_price: number } | null }) => {
    const soBuyPrice = (l.sales_order_lines as { buy_price: number } | null)?.buy_price || 0
    return sum + l.quantity * soBuyPrice
  }, 0)
  const variance = poTotal - quotedCost
  const varianceColor = variance <= 0 ? '#059669' : '#dc2626'

  const customer = (po.salesOrder as { customers: { id: string; name: string } | null } | null)?.customers
  const soNumber = (po.salesOrder as { so_number: string } | null)?.so_number
  const soId = (po.salesOrder as { id: string } | null)?.id

  return (
    <div>
      {/* Back link */}
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Purchase Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{po.po_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {isStockOrder && PURCHASE_TYPE_CONFIG.stock_order && <Badge label={PURCHASE_TYPE_CONFIG.stock_order.label} color={PURCHASE_TYPE_CONFIG.stock_order.color} bg={PURCHASE_TYPE_CONFIG.stock_order.bg} />}
          </div>
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {po.supplier && <span className="font-medium text-slate-700">{po.supplier.name}</span>}
            {soNumber && soId && (
              <span>
                from{' '}
                <Link href={`/orders/${soId}`} className="text-blue-600 hover:underline no-underline">
                  {soNumber}
                </Link>
              </span>
            )}
          </div>
        </div>

        <PoDetailActions poId={po.id} status={po.status} poNumber={po.po_number} supplierName={po.supplier?.name || 'Unknown Supplier'} />
      </div>

      {/* Context panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          {customer && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Customer</span>
              <div className="text-slate-700 mt-0.5">
                <Link href={`/customers/${customer.id}`} className="hover:underline no-underline text-slate-700">
                  {customer.name}
                </Link>
              </div>
            </div>
          )}
          {soNumber && soId && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sales Order</span>
              <div className="mt-0.5">
                <Link href={`/orders/${soId}`} className="text-blue-600 hover:underline no-underline">
                  {soNumber}
                </Link>
              </div>
            </div>
          )}
          {isStockOrder && !soNumber && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Order Type</span>
              <div className="text-slate-700 mt-0.5">Stock Replenishment</div>
            </div>
          )}
          {po.creator && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Created by</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Avatar user={po.creator as User} size={20} />
                <span className="text-slate-700">{po.creator.first_name} {po.creator.last_name}</span>
              </div>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Created</span>
            <div className="text-slate-700 mt-0.5">{formatDate(po.created_at)}</div>
          </div>
          {po.sent_at && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sent</span>
              <div className="text-slate-700 mt-0.5">{formatDate(po.sent_at)}</div>
            </div>
          )}
          {po.received_at && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Received</span>
              <div className="text-slate-700 mt-0.5">{formatDate(po.received_at)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {isStockOrder ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Goods Total" value={formatCurrency(goodsTotal)} accent="#1e293b" />
          <StatCard label="Delivery Cost" value={formatCurrency(deliveryCost)} accent="#6b7280" />
          <StatCard label="PO Total" value={formatCurrency(poTotal)} accent="#6366f1" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Goods Total" value={formatCurrency(goodsTotal)} accent="#1e293b" />
          <StatCard label="Delivery Cost" value={formatCurrency(deliveryCost)} accent="#6b7280" />
          <StatCard label="PO Total" value={formatCurrency(poTotal)} accent="#6366f1" />
          <StatCard label="Quoted Cost" value={formatCurrency(quotedCost)} accent="#64748b" />
          <StatCard
            label="Variance"
            value={`${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`}
            accent={varianceColor}
          />
        </div>
      )}

      {/* Delivery info */}
      <PoDeliveryInfo po={po} />

      {/* Lines table */}
      <PoLinesTable lines={lines} poId={po.id} poStatus={po.status} deliveryCost={deliveryCost} isStockOrder={isStockOrder} />

      {/* Activity */}
      <PoActivity activities={po.activities} />
    </div>
  )
}
