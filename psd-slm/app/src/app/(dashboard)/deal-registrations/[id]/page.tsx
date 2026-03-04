import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { DealRegActions } from './deal-reg-actions'
import { AttachmentsSection } from './attachments-section'

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: '#6366f1', bg: '#eef2ff' },
  active: { color: '#059669', bg: '#ecfdf5' },
  expired: { color: '#9ca3af', bg: '#f9fafb' },
  rejected: { color: '#dc2626', bg: '#fef2f2' },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DealRegistrationDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: dealReg } = await supabase
    .from('deal_registrations')
    .select(`
      *,
      customers(id, name),
      suppliers(id, name),
      users!deal_registrations_registered_by_fkey(id, first_name, last_name, initials, color)
    `)
    .eq('id', id)
    .single()

  if (!dealReg) notFound()

  // Fetch lines with product details
  const { data: lines } = await supabase
    .from('deal_registration_lines')
    .select('*, products(id, sku, name, default_buy_price)')
    .eq('deal_reg_id', id)

  // Fetch quote line usage
  const { data: quoteLineUsage } = await supabase
    .from('quote_lines')
    .select(`
      id, quantity, buy_price, created_at,
      quotes(id, quote_number, customers(name))
    `)
    .in('deal_reg_line_id', (lines || []).map((l) => l.id))

  // Fetch attachments with uploader info
  const { data: attachments } = await supabase
    .from('deal_registration_attachments')
    .select('*, users!deal_registration_attachments_uploaded_by_fkey(first_name, last_name)')
    .eq('deal_reg_id', id)
    .order('created_at', { ascending: false })

  const attachmentRows = (attachments || []).map((a) => {
    const uploader = a.users as unknown as { first_name: string; last_name: string } | null
    return {
      id: a.id,
      file_name: a.file_name,
      file_size: a.file_size,
      content_type: a.content_type,
      uploaded_by: a.uploaded_by,
      uploader_name: uploader ? `${uploader.first_name} ${uploader.last_name}` : '\u2014',
      created_at: a.created_at,
    }
  })

  const canUpload =
    hasPermission(user, 'deal_registrations', 'create') ||
    hasPermission(user, 'deal_registrations', 'edit_all') ||
    hasPermission(user, 'deal_registrations', 'edit_own')
  const canDeleteAttachments =
    hasPermission(user, 'deal_registrations', 'edit_all') ||
    hasPermission(user, 'deal_registrations', 'delete')

  const customer = dealReg.customers as unknown as { id: string; name: string } | null
  const supplier = dealReg.suppliers as unknown as { id: string; name: string } | null
  const registeredByUser = dealReg.users as unknown as {
    id: string; first_name: string; last_name: string; initials: string | null; color: string | null
  } | null

  const lineRows = (lines || []).map((l) => {
    const product = l.products as unknown as { id: string; sku: string; name: string; default_buy_price: number | null }
    const cataloguePrice = product?.default_buy_price ?? null
    const saving = cataloguePrice != null ? cataloguePrice - l.registered_buy_price : null
    const savingPct = cataloguePrice != null && cataloguePrice > 0
      ? ((cataloguePrice - l.registered_buy_price) / cataloguePrice) * 100
      : null

    return {
      id: l.id,
      product_name: product?.name || '\u2014',
      product_sku: product?.sku || '',
      catalogue_price: cataloguePrice,
      registered_buy_price: l.registered_buy_price,
      saving,
      saving_pct: savingPct,
      max_quantity: l.max_quantity,
    }
  })

  const totalSaving = lineRows.reduce((sum, l) => sum + (l.saving || 0), 0)
  const usageCount = quoteLineUsage?.length || 0

  // Expiry warning
  const isExpiringSoon = dealReg.expiry_date
    ? (() => {
        const diff = (new Date(dealReg.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        return diff > 0 && diff <= 30
      })()
    : false

  const statusCfg = STATUS_CONFIG[dealReg.status] || STATUS_CONFIG.pending

  return (
    <div>
      <Link
        href="/deal-registrations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; Deal Registrations
      </Link>

      <PageHeader
        title={dealReg.title}
        subtitle={dealReg.reference || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge label={dealReg.status} color={statusCfg.color} bg={statusCfg.bg} />
            <DealRegActions dealRegId={id} status={dealReg.status} />
          </div>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-6 mb-10">
        <StatCard label="Products Covered" value={lineRows.length} />
        <StatCard
          label="Total Saving"
          value={formatCurrency(totalSaving)}
          accent={totalSaving > 0 ? '#059669' : '#6b7280'}
        />
        <StatCard
          label="Times Used"
          value={usageCount}
          sub={usageCount > 0 ? `${usageCount} quote line${usageCount === 1 ? '' : 's'}` : 'Not yet used'}
        />
        <StatCard
          label="Days Remaining"
          value={
            dealReg.expiry_date
              ? (() => {
                  const days = Math.ceil((new Date(dealReg.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return days > 0 ? days : 'Expired'
                })()
              : 'No Expiry'
          }
          accent={
            dealReg.expiry_date
              ? (() => {
                  const days = Math.ceil((new Date(dealReg.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return days <= 0 ? '#dc2626' : days <= 30 ? '#d97706' : '#059669'
                })()
              : '#6b7280'
          }
        />
      </div>

      {/* Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Registration Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField
            label="Customer"
            value={customer?.name}
            href={customer ? `/customers/${customer.id}` : undefined}
          />
          <DetailField label="Supplier" value={supplier?.name} />
          <DetailField label="Reference" value={dealReg.reference} />
          <DetailField label="Registered Date" value={dealReg.registered_date ? formatDate(dealReg.registered_date) : null} />
          <DetailField
            label="Expiry Date"
            value={dealReg.expiry_date ? formatDate(dealReg.expiry_date) : null}
            className={isExpiringSoon ? 'text-amber-600' : ''}
            suffix={isExpiringSoon ? ' \u26a0 Expiring soon' : ''}
          />
          <DetailField
            label="Registered By"
            value={registeredByUser ? `${registeredByUser.first_name} ${registeredByUser.last_name}` : null}
            avatar={registeredByUser ? {
              initials: registeredByUser.initials || `${registeredByUser.first_name[0]}${registeredByUser.last_name[0]}`,
              color: registeredByUser.color || '#6366f1',
            } : undefined}
          />
          {dealReg.notes && (
            <DetailField label="Notes" value={dealReg.notes} className="col-span-2 lg:col-span-3" />
          )}
        </div>
      </div>

      {/* Supplier Confirmation Attachments */}
      <AttachmentsSection
        dealRegId={id}
        attachments={attachmentRows}
        canUpload={canUpload}
        canDelete={canDeleteAttachments}
      />

      {/* Product Lines */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Product Lines</h3>
        {lineRows.length === 0 ? (
          <p className="text-sm text-slate-400">No product lines.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">Product</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">SKU</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Catalogue Price</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Deal Price</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Saving</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Saving %</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Max Qty</th>
                </tr>
              </thead>
              <tbody>
                {lineRows.map((line) => (
                  <tr key={line.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium">{line.product_name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">{line.product_sku}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">
                      {line.catalogue_price != null ? formatCurrency(line.catalogue_price) : '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(line.registered_buy_price)}</td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {line.saving != null ? (
                        <span className={line.saving > 0 ? 'text-emerald-600 font-medium' : line.saving < 0 ? 'text-red-600' : 'text-slate-400'}>
                          {formatCurrency(line.saving)}
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {line.saving_pct != null ? (
                        <span className={line.saving_pct >= 10 ? 'text-emerald-600' : line.saving_pct >= 5 ? 'text-amber-600' : 'text-slate-400'}>
                          {line.saving_pct.toFixed(1)}%
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">{line.max_quantity ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Quote Usage</h3>
        {usageCount === 0 ? (
          <p className="text-sm text-slate-400">No quotes have used this deal registration yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Quote #</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Customer</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Qty</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Deal Price Used</th>
                  <th className="px-5 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Quote Date</th>
                </tr>
              </thead>
              <tbody>
                {(quoteLineUsage || []).map((ql) => {
                  const quote = ql.quotes as unknown as { id: string; quote_number: string; customers: { name: string } } | null
                  return (
                    <tr key={ql.id} className="border-b border-slate-50">
                      <td className="px-5 py-2.5">
                        {quote ? (
                          <Link href={`/quotes/${quote.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {quote.quote_number}
                          </Link>
                        ) : '\u2014'}
                      </td>
                      <td className="px-5 py-2.5">{quote?.customers?.name || '\u2014'}</td>
                      <td className="px-5 py-2.5 text-right">{ql.quantity}</td>
                      <td className="px-5 py-2.5 text-right">{formatCurrency(ql.buy_price)}</td>
                      <td className="px-5 py-2.5">{formatDate(ql.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
  href,
  suffix,
  avatar,
}: {
  label: string
  value: string | null | undefined
  className?: string
  href?: string
  suffix?: string
  avatar?: { initials: string; color: string }
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-slate-700 flex items-center gap-1.5">
        {avatar && (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatar.color }}
          >
            {avatar.initials}
          </div>
        )}
        {href && value ? (
          <Link href={href} className="text-blue-600 hover:underline">
            {value}
          </Link>
        ) : (
          <span>{value || '\u2014'}{suffix}</span>
        )}
      </div>
    </div>
  )
}
