import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, SO_HEADER_STATUS_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { deriveSoStatus, deriveSoDisplayStatus } from '@/lib/sales-orders'
import { getSalesOrder, getActiveSuppliers } from '../actions'
import { getPurchaseOrdersForSo } from '../../purchase-orders/actions'
import { getSoFulfilmentData } from '../../stock/actions'
import { getDeliveryNotesForSo } from '../../delivery-notes/actions'
import { getInvoicesForSalesOrder } from '../../invoices/actions'
import { SoDetailActions } from './so-detail-actions'
import { SoLinesTable } from './so-lines-table'
import { SoPoSection } from './so-po-section'
import { SoFulfilmentSection } from './so-fulfilment-section'
import { SoInvoicesSection } from './so-invoices-section'
import { SoActivity } from './so-activity'
import { SoCollectionsSection } from './so-collections-section'
import { SoInstallCard } from './so-install-card'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SalesOrderDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('sales_orders', 'view')

  const getCollectionsForSo = import('@/lib/collections/actions').then(m => m.getCollectionsForSo)
  const getLinkedJobsImport = import('../actions').then(m => m.getLinkedJobsForSo)

  const [so, suppliers, purchaseOrders, fulfilmentData, deliveryNotes, invoices, collections, linkedJobs] = await Promise.all([
    getSalesOrder(id),
    getActiveSuppliers(),
    getPurchaseOrdersForSo(id),
    getSoFulfilmentData(id).catch(() => ({ fulfilmentLines: [], allocations: [], stockAvailability: {} })),
    getDeliveryNotesForSo(id).catch(() => []),
    getInvoicesForSalesOrder(id).catch(() => []),
    getCollectionsForSo.then(fn => fn(id)).catch(() => []),
    getLinkedJobsImport.then(fn => fn(id)).catch(() => []),
  ])
  if (!so) notFound()

  const derivedStatus = deriveSoStatus(so.lines)
  const displayStatus = deriveSoDisplayStatus(so.lines)
  const statusCfg = SO_HEADER_STATUS_CONFIG[displayStatus]

  // Calculate totals
  type SoLineRow = { id: string; status: string; quantity: number; buy_price: number; sell_price: number; fulfilment_route: string; delivery_destination: string | null; group_name: string | null; group_sort: number; sort_order: number; description: string; requires_contract: boolean; deal_reg_line_id: string | null; sales_order_id: string; is_service: boolean; quantity_received: number; serial_numbers_received: string[]; supplier_id: string | null; products: { id: string; name: string; sku: string; is_stocked: boolean; is_serialised: boolean | null } | null; suppliers: { id: string; name: string } | null }
  const lines = (so.lines || []) as SoLineRow[]
  const activeLines = lines.filter((l: SoLineRow) => l.status !== 'cancelled')
  const subtotal = activeLines.reduce((sum: number, l: SoLineRow) => sum + l.quantity * l.sell_price, 0)
  const totalCost = activeLines.reduce((sum: number, l: SoLineRow) => sum + l.quantity * l.buy_price, 0)
  const marginAmt = subtotal - totalCost
  const marginPct = subtotal > 0 ? (marginAmt / subtotal) * 100 : 0
  const vatAmount = subtotal * (so.vat_rate / 100)
  const grandTotal = subtotal + vatAmount

  return (
    <div>
      {/* Back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; All Sales Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{so.so_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
          </div>
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {so.customer && (
              <Link href={`/customers/${so.customer.id}`} className="hover:text-slate-700 no-underline">
                {so.customer.name}
              </Link>
            )}
            {so.contact && (
              <span>{so.contact.first_name} {so.contact.last_name}</span>
            )}
            {so.assignedUser && (
              <span className="flex items-center gap-1.5">
                <Avatar user={so.assignedUser as User} size={20} />
                {so.assignedUser.first_name} {so.assignedUser.last_name}
              </span>
            )}
            {so.quote_number && (
              <Link href={`/quotes/${so.quote_id}`} className="hover:text-slate-700 no-underline text-blue-600">
                {so.quote_number}
              </Link>
            )}
          </div>
        </div>

        <SoDetailActions soId={so.id} derivedStatus={displayStatus} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Subtotal" value={formatCurrency(subtotal)} accent="#1e293b" />
        <StatCard label="VAT" value={formatCurrency(vatAmount)} sub={`${so.vat_rate}%`} accent="#6b7280" />
        <StatCard label="Grand Total" value={formatCurrency(grandTotal)} accent="#6366f1" />
        <StatCard
          label="Margin"
          value={formatCurrency(marginAmt)}
          sub={`${marginPct.toFixed(1)}%`}
          accent={marginPct >= 30 ? '#059669' : marginPct >= 15 ? '#d97706' : '#dc2626'}
        />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Delivery */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Delivery</h3>
          <div className="space-y-2 text-sm">
            <DetailField label="Delivery Date" value={so.requested_delivery_date ? formatDate(so.requested_delivery_date) : null} />
            <DetailField
              label="Address"
              value={[so.delivery_address_line1, so.delivery_address_line2, so.delivery_city, so.delivery_postcode]
                .filter(Boolean)
                .join(', ') || null}
            />
          </div>
        </div>

        {/* Installation */}
        <SoInstallCard
          soId={so.id}
          soNumber={so.so_number}
          customerId={so.customer_id}
          contactId={so.contact_id}
          requiresInstall={so.requires_install}
          requestedInstallDate={so.requested_install_date}
          installNotes={so.install_notes}
          deliveryAddress={{
            line1: so.delivery_address_line1,
            line2: so.delivery_address_line2,
            city: so.delivery_city,
            postcode: so.delivery_postcode,
          }}
          linkedJobs={linkedJobs}
        />

        {/* Order Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Order Details</h3>
          <div className="space-y-2 text-sm">
            <DetailField label="Customer PO" value={so.customer_po} />
            <DetailField label="Created" value={formatDate(so.created_at)} />
            {so.accepted_at && <DetailField label="Accepted" value={formatDate(so.accepted_at)} />}
            <DetailField label="Lines" value={`${lines.length} (${activeLines.length} active)`} />
          </div>
        </div>
      </div>

      {/* Notes */}
      {so.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-amber-800 mb-2">Internal Notes</h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{so.notes}</p>
        </div>
      )}

      {/* Delivery Summary */}
      {activeLines.length > 0 && (() => {
        const psdOffice = activeLines.filter((l: SoLineRow) => l.delivery_destination === 'psd_office')
        const customerSite = activeLines.filter((l: SoLineRow) => l.delivery_destination === 'customer_site')
        const services = activeLines.filter((l: SoLineRow) => l.is_service)
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
            <h3 className="text-[15px] font-semibold mb-4">Delivery Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{psdOffice.length}</div>
                <div className="text-xs text-amber-600 mt-0.5">Warehouse</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{customerSite.length}</div>
                <div className="text-xs text-blue-600 mt-0.5">Customer Site</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{services.length}</div>
                <div className="text-xs text-purple-600 mt-0.5">Services</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Fulfilment Section */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SoFulfilmentSection
        soId={so.id}
        customerId={so.customer_id}
        fulfilmentLines={fulfilmentData.fulfilmentLines as any}
        allocations={fulfilmentData.allocations as any}
        stockAvailability={fulfilmentData.stockAvailability}
        deliveryAddress={{
          line1: so.delivery_address_line1,
          line2: so.delivery_address_line2,
          city: so.delivery_city,
          postcode: so.delivery_postcode,
        }}
        suppliers={suppliers}
        soLines={lines as any}
      />

      {/* Collections */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SoCollectionsSection collections={collections as any} />

      {/* Lines table */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SoLinesTable lines={lines} soId={so.id} suppliers={suppliers} purchaseOrders={purchaseOrders as any} customerPo={so.customer_po} />

      {/* Purchase Orders section */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {purchaseOrders.length > 0 && <SoPoSection purchaseOrders={purchaseOrders as any} />}

      {/* Invoices section */}
      <SoInvoicesSection
        soId={so.id}
        invoices={invoices as { id: string; invoice_number: string; status: string; effectiveStatus: string; invoice_type: string; total: number; paid_at: string | null; created_at: string; due_date: string | null }[]}
        derivedStatus={derivedStatus}
        allLinesFullyInvoiced={activeLines.every((l: SoLineRow) => ((l as unknown as { quantity_invoiced?: number }).quantity_invoiced || 0) >= l.quantity)}
        totalInvoiced={invoices.filter((i: { invoice_type: string }) => i.invoice_type !== 'credit_note').reduce((sum: number, i: { total: number }) => sum + i.total, 0)}
        totalSoValue={grandTotal}
        goodsReceivedStatus={(() => {
          const physicalLines = activeLines.filter((l: SoLineRow) => !l.is_service)
          if (physicalLines.length === 0) return 'all' as const
          const receivedLines = physicalLines.filter((l: SoLineRow) => l.quantity_received > 0)
          if (receivedLines.length === 0) return 'none' as const
          return receivedLines.length >= physicalLines.length ? 'all' as const : 'partial' as const
        })()}
      />

      {/* Activity */}
      <SoActivity activities={so.activities} />
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-slate-700">{value || '\u2014'}</div>
    </div>
  )
}
