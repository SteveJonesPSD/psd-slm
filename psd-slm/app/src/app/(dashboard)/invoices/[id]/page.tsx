import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, INVOICE_STATUS_CONFIG, INVOICE_TYPE_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getMarginAccent } from '@/lib/margin'
import { getMarginThresholds } from '@/lib/margin-settings'
import { getInvoice } from '../actions'
import { InvoiceDetailActions } from './invoice-detail-actions'
import { InvoiceActivity } from './invoice-activity'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('invoices', 'view')

  const [invoice, marginThresholds] = await Promise.all([
    getInvoice(id),
    getMarginThresholds(),
  ])
  if (!invoice) notFound()

  const statusCfg = INVOICE_STATUS_CONFIG[invoice.effectiveStatus]
  const typeCfg = invoice.invoice_type !== 'standard' ? INVOICE_TYPE_CONFIG[invoice.invoice_type] : null

  // Calculate margin
  const totalRevenue = (invoice.lines || []).reduce((sum: number, l: { quantity: number; unit_price: number }) => sum + l.quantity * l.unit_price, 0)
  const totalCost = (invoice.lines || []).reduce((sum: number, l: { quantity: number; unit_cost: number }) => sum + l.quantity * l.unit_cost, 0)
  const marginAmt = totalRevenue - totalCost
  const marginPct = totalRevenue > 0 ? (marginAmt / totalRevenue) * 100 : 0

  // Due date styling
  const isOverdue = invoice.effectiveStatus === 'overdue'

  // Group lines by group_name
  type InvLine = { id: string; description: string; quantity: number; unit_price: number; unit_cost: number; vat_rate: number; sort_order: number; group_name: string | null; products: { id: string; name: string; sku: string } | null; sales_order_lines: { serial_numbers_received: string[] } | null }
  const lines = (invoice.lines || []) as InvLine[]
  const groupedLines = new Map<string | null, InvLine[]>()
  for (const line of lines) {
    const key = line.group_name
    if (!groupedLines.has(key)) groupedLines.set(key, [])
    groupedLines.get(key)!.push(line)
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; All Invoices
      </Link>

      {/* Breadcrumb chain */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-6 flex-wrap">
        {invoice.quote && (
          <>
            <Link href={`/quotes/${invoice.quote.id}`} className="hover:text-slate-600 no-underline">
              {invoice.quote.quote_number}
            </Link>
            <span>&rarr;</span>
          </>
        )}
        {invoice.salesOrder && (
          <>
            <Link href={`/orders/${invoice.salesOrder.id}`} className="hover:text-slate-600 no-underline">
              {invoice.salesOrder.so_number}
            </Link>
            <span>&rarr;</span>
          </>
        )}
        <span className="text-slate-600 font-medium">{invoice.invoice_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
          </div>
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {invoice.customer && (
              <Link href={`/customers/${invoice.customer.id}`} className="hover:text-slate-700 no-underline">
                {invoice.customer.name}
              </Link>
            )}
            {invoice.contact && (
              <span>{invoice.contact.first_name} {invoice.contact.last_name}</span>
            )}
            {invoice.brand && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {invoice.brand.name}
              </span>
            )}
          </div>
        </div>

        <InvoiceDetailActions
          invoiceId={invoice.id}
          status={invoice.effectiveStatus}
          invoiceType={invoice.invoice_type}
          invoiceNumber={invoice.invoice_number}
          parentInvoiceId={invoice.parent_invoice_id}
          contactName={invoice.contact ? `${invoice.contact.first_name} ${invoice.contact.last_name}` : null}
          contactEmail={invoice.contact?.email || null}
          invoiceTotal={invoice.total}
          salesOrderId={invoice.salesOrder?.id || null}
          lines={lines.map((l) => ({
            salesOrderLineId: l.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unit_price,
            unitCost: l.unit_cost,
            vatRate: l.vat_rate,
            productId: l.products?.id || null,
            sortOrder: l.sort_order,
            groupName: l.group_name,
          }))}
        />
      </div>

      {/* Address cards */}
      {invoice.customer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Bill To</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">{invoice.customer.name}</div>
            <div className="text-sm text-slate-500 space-y-0.5">
              {invoice.customer.address_line1 && <div>{invoice.customer.address_line1}</div>}
              {invoice.customer.address_line2 && <div>{invoice.customer.address_line2}</div>}
              {(invoice.customer.city || invoice.customer.postcode) && (
                <div>{[invoice.customer.city, invoice.customer.postcode].filter(Boolean).join(', ')}</div>
              )}
            </div>
            {invoice.contact && (
              <div className="text-sm text-slate-400 mt-2">Attn: {invoice.contact.first_name} {invoice.contact.last_name}</div>
            )}
          </div>
          {/* Deliver To — only if SO has a custom delivery address that differs from billing */}
          {invoice.salesOrder && invoice.salesOrder.delivery_address_line1 && (
            invoice.salesOrder.delivery_address_line1 !== invoice.customer.address_line1 ||
            invoice.salesOrder.delivery_postcode !== invoice.customer.postcode
          ) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Deliver To</div>
              <div className="text-sm text-slate-500 space-y-0.5">
                {invoice.salesOrder.delivery_address_line1 && <div>{invoice.salesOrder.delivery_address_line1}</div>}
                {invoice.salesOrder.delivery_address_line2 && <div>{invoice.salesOrder.delivery_address_line2}</div>}
                {(invoice.salesOrder.delivery_city || invoice.salesOrder.delivery_postcode) && (
                  <div>{[invoice.salesOrder.delivery_city, invoice.salesOrder.delivery_postcode].filter(Boolean).join(', ')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Customer PO</div>
          <div className="text-sm font-medium text-slate-700">{invoice.customer_po || '\u2014'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Payment Terms</div>
          <div className="text-sm font-medium text-slate-700">{invoice.payment_terms ? `${invoice.payment_terms} days` : '\u2014'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Invoice Date</div>
          <div className="text-sm font-medium text-slate-700">{formatDate(invoice.created_at)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Due Date</div>
          <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
            {invoice.due_date ? formatDate(invoice.due_date) : '\u2014'}
          </div>
        </div>
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Subtotal" value={formatCurrency(invoice.subtotal)} accent="#1e293b" />
        <StatCard label="VAT" value={formatCurrency(invoice.vat_amount)} sub={`${invoice.vat_rate || 20}%`} accent="#6b7280" />
        <StatCard
          label="Total"
          value={formatCurrency(invoice.total)}
          accent={invoice.total < 0 ? '#dc2626' : '#059669'}
        />
        <StatCard
          label="Margin"
          value={formatCurrency(marginAmt)}
          sub={`${marginPct.toFixed(1)}%`}
          accent={getMarginAccent(marginPct, marginThresholds.green, marginThresholds.amber)}
        />
      </div>

      {/* Void reason banner */}
      {invoice.effectiveStatus === 'void' && (() => {
        // Find void activity for reason
        const voidActivity = (invoice.activities || []).find(
          (a: { action: string; details: Record<string, string> | null }) => a.action === 'invoice.voided'
        ) as { action: string; created_at: string; details: { reason?: string } | null; users: { first_name: string; last_name: string } | null } | undefined
        const voidReason = voidActivity?.details?.reason
        const voidDate = voidActivity?.created_at ? formatDate(voidActivity.created_at) : null
        const voidBy = voidActivity?.users ? `${voidActivity.users.first_name} ${voidActivity.users.last_name}` : null
        return voidReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 mb-8">
            <h3 className="text-[13px] font-semibold text-red-800 mb-2">Invoice Voided</h3>
            <p className="text-sm text-red-900">
              {voidDate && voidBy && <span>Voided on {voidDate} by {voidBy}. </span>}
              <strong>Reason:</strong> {voidReason}
            </p>
          </div>
        ) : null
      })()}

      {/* Internal notes */}
      {invoice.internal_notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-amber-800 mb-2">Internal Notes</h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{invoice.internal_notes}</p>
        </div>
      )}

      {/* Credit note parent reference */}
      {invoice.parentInvoice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-amber-800 mb-2">Credit Note For</h3>
          <p className="text-sm text-amber-900">
            This credit note is against invoice{' '}
            <Link href={`/invoices/${invoice.parentInvoice.id}`} className="font-semibold text-amber-900 underline">
              {invoice.parentInvoice.invoice_number}
            </Link>
            {' '}({formatCurrency(invoice.parentInvoice.total)})
          </p>
        </div>
      )}

      {/* Attribution section */}
      {invoice.attributions && invoice.attributions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
          <h3 className="text-[15px] font-semibold mb-4">Sales Attribution</h3>
          <div className="flex flex-wrap gap-3">
            {invoice.attributions.map((attr: { id: string; attribution_type: string; split_pct: number; users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null }) => (
              <div key={attr.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                {attr.users && (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: attr.users.color || '#6366f1' }}
                  >
                    {attr.users.initials || (attr.users.first_name[0] + attr.users.last_name[0])}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {attr.users?.first_name} {attr.users?.last_name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {attr.attribution_type} &middot; {attr.split_pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice lines */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[600px]">
            <thead>
              <tr>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">VAT Rate</th>
                <th className="border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groupedLines.entries()).map(([groupName, groupLines]) => (
                <GroupRows key={groupName || '__ungrouped'} groupName={groupName} lines={groupLines} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={5} className="px-5 py-3 text-right text-sm text-slate-500 font-medium">Subtotal</td>
                <td className="px-5 py-3 text-right text-sm font-semibold">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="px-5 py-3 text-right text-sm text-slate-500 font-medium">VAT ({invoice.vat_rate || 20}%)</td>
                <td className="px-5 py-3 text-right text-sm font-semibold">{formatCurrency(invoice.vat_amount)}</td>
              </tr>
              <tr className="bg-slate-900 text-white">
                <td colSpan={5} className="px-5 py-3 text-right text-sm font-bold">TOTAL</td>
                <td className="px-5 py-3 text-right text-sm font-bold">{formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Related section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Links */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Related</h3>
          <div className="space-y-2 text-sm">
            {invoice.salesOrder && (
              <div>
                <span className="text-slate-400">Sales Order:</span>{' '}
                <Link href={`/orders/${invoice.salesOrder.id}`} className="text-blue-600 hover:underline no-underline font-medium">
                  {invoice.salesOrder.so_number}
                </Link>
              </div>
            )}
            {invoice.quote && (
              <div>
                <span className="text-slate-400">Quote:</span>{' '}
                <Link href={`/quotes/${invoice.quote.id}`} className="text-blue-600 hover:underline no-underline font-medium">
                  {invoice.quote.quote_number}
                </Link>
              </div>
            )}
            {invoice.quote?.opportunity_id && (
              <div>
                <span className="text-slate-400">Opportunity:</span>{' '}
                <Link href={`/opportunities/${invoice.quote.opportunity_id}`} className="text-blue-600 hover:underline no-underline font-medium">
                  View Opportunity
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Other invoices for same SO */}
        {invoice.relatedInvoices.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-[15px] font-semibold mb-4">Other Invoices</h3>
            <div className="space-y-2 text-sm">
              {invoice.relatedInvoices.map((ri: { id: string; invoice_number: string; status: string; total: number; invoice_type: string }) => {
                const riCfg = INVOICE_STATUS_CONFIG[ri.status]
                return (
                  <div key={ri.id} className="flex items-center justify-between">
                    <Link href={`/invoices/${ri.id}`} className="text-blue-600 hover:underline no-underline font-medium">
                      {ri.invoice_number}
                    </Link>
                    <div className="flex items-center gap-2">
                      {riCfg && <Badge label={riCfg.label} color={riCfg.color} bg={riCfg.bg} />}
                      <span className={`font-medium ${ri.total < 0 ? 'text-red-600' : ''}`}>
                        {formatCurrency(ri.total)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Activity */}
      <InvoiceActivity activities={invoice.activities} />
    </div>
  )
}

function GroupRows({ groupName, lines }: { groupName: string | null; lines: { id: string; description: string; quantity: number; unit_price: number; vat_rate: number; products: { name: string; sku: string } | null; sales_order_lines?: { serial_numbers_received: string[] } | null }[] }) {
  return (
    <>
      {groupName && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {groupName}
          </td>
        </tr>
      )}
      {lines.map((line) => {
        const serials = line.sales_order_lines?.serial_numbers_received
        const hasSerials = serials && serials.length > 0
        return (
          <tr key={line.id} className="border-b border-slate-100">
            <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
              {line.products?.sku || '\u2014'}
            </td>
            <td className="px-5 py-3 text-slate-700">
              {line.description}
              {hasSerials && (
                <div className="text-xs text-slate-400 mt-0.5" title={serials!.join(', ')}>
                  SN: {serials!.length <= 5 ? serials!.join(', ') : `${serials!.slice(0, 5).join(', ')} +${serials!.length - 5} more`}
                </div>
              )}
            </td>
            <td className="px-5 py-3 text-right whitespace-nowrap">{line.quantity}</td>
            <td className="px-5 py-3 text-right whitespace-nowrap">{formatCurrency(line.unit_price)}</td>
            <td className="px-5 py-3 text-right whitespace-nowrap">{line.vat_rate}%</td>
            <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
              {formatCurrency(line.quantity * line.unit_price)}
            </td>
          </tr>
        )
      })}
    </>
  )
}
