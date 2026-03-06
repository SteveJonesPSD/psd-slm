import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getMarginColor, getMarginAccent } from '@/lib/margin'
import { getMarginThresholds } from '@/lib/margin-settings'
import { QuoteDetailActions, QuoteBottomEdit } from './quote-detail-actions'
import { AcknowledgementBanner } from './acknowledgement-banner'
import { ChangeRequestsSection } from './change-requests-section'
import { ActivitySection } from './activity-section'
import { PoDownloadButton } from './po-download-button'
import { VersionHistoryPanel } from './version-history-panel'
import { RevisedBanner } from './revised-banner'
import { QuoteAttachmentsSection } from './attachments-section'
import { MobileQuoteDetail } from './mobile-quote-detail'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('quotes', 'view')
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (!quote) notFound()

  // Fetch related data in parallel
  const [
    { data: customer },
    { data: contact },
    { data: assignedUser },
    { data: groups },
    { data: lines },
    { data: attributions },
    { data: opportunity },
    { data: brand },
    { data: changeRequests },
    { data: activities },
    { data: acknowledgedByUser },
    { data: versionSiblings },
    { data: existingSo },
    { data: attachmentsRaw },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('id', quote.customer_id).single(),
    quote.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('id', quote.contact_id).single()
      : Promise.resolve({ data: null }),
    quote.assigned_to
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', quote.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_groups').select('*').eq('quote_id', id).order('sort_order'),
    supabase.from('quote_lines').select('*, products(name, sku), suppliers(name)').eq('quote_id', id).order('sort_order'),
    supabase.from('quote_attributions').select('*, users(first_name, last_name, initials, color)').eq('quote_id', id),
    quote.opportunity_id
      ? supabase.from('opportunities').select('id, title').eq('id', quote.opportunity_id).single()
      : Promise.resolve({ data: null }),
    quote.brand_id
      ? supabase.from('brands').select('id, name, logo_path').eq('id', quote.brand_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_change_requests').select('*, resolved_user:resolved_by(first_name, last_name)').eq('quote_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*, users:user_id(first_name, last_name, initials, color)').eq('entity_type', 'quote').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    quote.acknowledged_by
      ? supabase.from('users').select('first_name, last_name').eq('id', quote.acknowledged_by).single()
      : Promise.resolve({ data: null }),
    // Fetch sibling versions for version history panel
    supabase
      .from('quotes')
      .select('id, quote_number, version, status, revision_notes, created_at, assigned_to, users!quotes_assigned_to_fkey(first_name, last_name)')
      .eq('base_quote_number', quote.base_quote_number)
      .order('version', { ascending: false }),
    // Check if a sales order already exists for this quote
    supabase
      .from('sales_orders')
      .select('id')
      .eq('quote_id', id)
      .maybeSingle(),
    // Fetch attachments
    supabase
      .from('quote_attachments')
      .select('*, users!quote_attachments_uploaded_by_fkey(first_name, last_name)')
      .eq('quote_id', id)
      .order('created_at', { ascending: false }),
  ])

  const marginThresholds = await getMarginThresholds()

  // Find the active version in the family (for revised banner)
  // Supabase FK joins return arrays — normalize users to single object
  const siblingVersions = ((versionSiblings || []) as unknown as { id: string; quote_number: string; version: number; status: string; revision_notes: string | null; created_at: string; assigned_to: string | null; users: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }[]).map((v) => ({
    ...v,
    users: Array.isArray(v.users) ? v.users[0] || null : v.users,
  }))
  const activeVersion = siblingVersions.find((v) => v.id !== id && !['revised', 'superseded'].includes(v.status))

  // Map attachment rows
  const attachmentRows = (attachmentsRaw || []).map((a: { id: string; file_name: string; file_size: number; mime_type: string; uploaded_by: string; label: string | null; source: string; created_at: string; users: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }) => {
    const uploader = Array.isArray(a.users) ? a.users[0] : a.users
    return {
      id: a.id,
      file_name: a.file_name,
      file_size: a.file_size,
      mime_type: a.mime_type,
      uploaded_by: a.uploaded_by,
      uploader_name: uploader ? `${uploader.first_name} ${uploader.last_name}` : '\u2014',
      label: a.label,
      source: a.source,
      created_at: a.created_at,
    }
  })

  const statusCfg = QUOTE_STATUS_CONFIG[quote.status as keyof typeof QUOTE_STATUS_CONFIG]
  const typeCfg = quote.quote_type ? QUOTE_TYPE_CONFIG[quote.quote_type as keyof typeof QUOTE_TYPE_CONFIG] : null

  // Calculate totals
  type LineRow = {
    id: string; group_id: string | null; sort_order: number; description: string; quantity: number;
    buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean;
    requires_contract: boolean; deal_reg_line_id: string | null; notes: string | null;
    product_id: string | null;
    products: { name: string; sku: string } | null; suppliers: { name: string } | null
  }
  const allLines = (lines || []) as LineRow[]
  const nonOptionalLines = allLines.filter((l) => !l.is_optional)
  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
  const totalCost = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const marginAmt = subtotal - totalCost
  const marginPct = subtotal > 0 ? (marginAmt / subtotal) * 100 : 0
  const vatAmount = subtotal * (quote.vat_rate / 100)
  const grandTotal = subtotal + vatAmount

  // Group lines by group
  type GroupRow = { id: string; name: string; sort_order: number }
  const typedGroups = (groups || []) as GroupRow[]
  const groupedLines = typedGroups.map((g) => ({
    ...g,
    lines: allLines.filter((l) => l.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order),
  }))

  // Ungrouped lines
  const ungroupedLines = allLines.filter((l) => !l.group_id)

  // Portal URL — only live once quote has been sent
  const portalUrl = quote.portal_token && quote.status !== 'draft' && quote.status !== 'review'
    ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/q/${quote.portal_token}`
    : null

  const mobileDetail = (
    <MobileQuoteDetail
      quote={quote}
      customer={customer}
      contact={contact ? { id: contact.id, first_name: contact.first_name, last_name: contact.last_name, email: contact.email } : null}
      assignedUser={assignedUser}
      allLines={allLines}
      groups={typedGroups}
      attributions={(attributions || []).map(a => ({
        id: a.id,
        attribution_type: a.attribution_type,
        split_pct: a.split_pct,
        users: a.users as { first_name: string; last_name: string; initials: string | null; color: string | null } | null,
      }))}
      opportunity={opportunity}
      brand={brand}
      portalUrl={portalUrl}
      existingSoId={existingSo?.id || null}
      subtotal={subtotal}
      totalCost={totalCost}
      marginAmt={marginAmt}
      marginPct={marginPct}
      vatAmount={vatAmount}
      grandTotal={grandTotal}
      customerNotes={quote.customer_notes}
      internalNotes={quote.internal_notes}
      marginThresholds={marginThresholds}
    />
  )

  const desktopDetail = (
    <div className="pb-16">
      {/* Back link */}
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; All Quotes
      </Link>

      {/* Revised banner */}
      {quote.status === 'revised' && (
        <RevisedBanner
          quoteId={quote.id}
          activeVersionId={activeVersion?.id || null}
          activeVersionNumber={activeVersion?.quote_number || null}
        />
      )}

      {/* Acceptance acknowledgement */}
      {quote.status === 'accepted' && (
        <AcknowledgementBanner
          quoteId={quote.id}
          customerPo={quote.customer_po}
          hasPoDocument={!!quote.po_document_path}
          acknowledgedAt={quote.acknowledged_at}
          acknowledgedByName={
            acknowledgedByUser
              ? `${acknowledgedByUser.first_name} ${acknowledgedByUser.last_name}`
              : null
          }
          signedByName={quote.signed_by_name}
          hasSignature={!!quote.signature_image_path}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{quote.quote_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
            {quote.version > 1 && (
              <Badge label={`v${quote.version}`} color="#6b7280" bg="#f3f4f6" />
            )}
          </div>
          {quote.title && (
            <p className="text-base text-slate-600 dark:text-slate-400 mb-0.5">{quote.title}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {customer && (
              <Link href={`/customers/${customer.id}`} className="hover:text-slate-700 no-underline">
                {customer.name}
              </Link>
            )}
            {contact && (
              <span>{contact.first_name} {contact.last_name}</span>
            )}
            {assignedUser && (
              <span className="flex items-center gap-1.5">
                <Avatar user={assignedUser as User} size={20} />
                {assignedUser.first_name} {assignedUser.last_name}
              </span>
            )}
            {opportunity && (
              <Link href={`/pipeline/${opportunity.id}`} className="hover:text-slate-700 no-underline text-blue-600">
                {opportunity.title}
              </Link>
            )}
            {brand && (
              <span className="flex items-center gap-1.5">
                {brand.logo_path && (
                  <img src={brand.logo_path} alt="" className="h-4 w-4 rounded object-contain" />
                )}
                {brand.name}
              </span>
            )}
          </div>
        </div>

        <QuoteDetailActions
          quote={quote}
          portalUrl={portalUrl}
          existingSoId={existingSo?.id || null}
          contact={contact ? { first_name: contact.first_name, last_name: contact.last_name, email: contact.email } : null}
          customer={customer ? { name: customer.name } : null}
          brand={brand ? { name: brand.name } : null}
          assignedUser={assignedUser ? { id: assignedUser.id, first_name: assignedUser.first_name, last_name: assignedUser.last_name } : null}
          subtotal={subtotal}
          zeroSellLines={nonOptionalLines.filter(l => l.sell_price === 0).map(l => l.description)}
        />
      </div>

      {/* Revision notes banner */}
      {quote.revision_notes && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <div>
            <span className="text-xs font-semibold text-amber-700">Revision Notes</span>
            <p className="text-sm text-amber-800 mt-0.5">{quote.revision_notes}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Subtotal" value={formatCurrency(subtotal)} accent="#1e293b" />
        <StatCard label="VAT" value={formatCurrency(vatAmount)} sub={`${quote.vat_rate}%`} accent="#6b7280" />
        <StatCard label="Grand Total" value={formatCurrency(grandTotal)} accent="#6366f1" />
        <StatCard
          label="Margin"
          value={formatCurrency(marginAmt)}
          sub={`${marginPct.toFixed(1)}%`}
          accent={getMarginAccent(marginPct, marginThresholds.green, marginThresholds.amber)}
        />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Attribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Sales Attribution</h3>
          {attributions && attributions.length > 0 ? (
            <div className="space-y-2">
              {attributions.map((a) => {
                const u = a.users as { first_name: string; last_name: string; initials: string | null; color: string | null } | null
                return (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {u && <Avatar user={u as User} size={22} />}
                      <span>{u ? `${u.first_name} ${u.last_name}` : 'Unknown'}</span>
                      <Badge
                        label={a.attribution_type}
                        color={a.attribution_type === 'direct' ? '#059669' : a.attribution_type === 'override' ? '#d97706' : '#6b7280'}
                        bg={a.attribution_type === 'direct' ? '#ecfdf5' : a.attribution_type === 'override' ? '#fffbeb' : '#f3f4f6'}
                      />
                    </div>
                    <span className="font-semibold">{a.split_pct}%</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No attribution set.</p>
          )}
        </div>

        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <DetailField label="Valid Until" value={quote.valid_until ? formatDate(quote.valid_until) : null} />
            <DetailField label="Created" value={formatDate(quote.created_at)} />
            {quote.sent_at && <DetailField label="Sent" value={formatDate(quote.sent_at)} />}
            {quote.accepted_at && <DetailField label="Accepted" value={formatDate(quote.accepted_at)} />}
            {quote.customer_po && (
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Customer PO</div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  {quote.customer_po}
                  {quote.po_document_path && <PoDownloadButton quoteId={quote.id} />}
                </div>
              </div>
            )}
            <DetailField label="Lines" value={`${allLines.length} (${nonOptionalLines.length} firm)`} />
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="mb-8">
        <QuoteAttachmentsSection
          quoteId={id}
          attachments={attachmentRows}
          canUpload={quote.status === 'draft' || quote.status === 'review'}
          canDelete={quote.status === 'draft' || quote.status === 'review'}
        />
      </div>

      {/* Notes */}
      {quote.customer_notes && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-blue-800 mb-2">Customer Notes</h3>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{quote.customer_notes}</p>
        </div>
      )}

      {quote.internal_notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-amber-800 mb-2">Internal Notes</h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{quote.internal_notes}</p>
        </div>
      )}

      {/* Portal link */}
      {portalUrl && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 mb-8">
          <h3 className="text-[13px] font-semibold text-purple-800 mb-2">Customer Portal Link</h3>
          <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 underline hover:text-purple-900 break-all">{portalUrl}</a>
        </div>
      )}

      {/* Version History */}
      <VersionHistoryPanel versions={siblingVersions} currentQuoteId={id} />

      {/* Grouped line items */}
      <div className="rounded-xl border border-gray-200 bg-white mb-8">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Line Items</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route</th>
                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margin</th>
                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                <th className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Flags</th>
              </tr>
            </thead>
            <tbody>
              {groupedLines.map((group) => (
                <React.Fragment key={group.id}>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600">
                    <td colSpan={10} className="px-5 py-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{group.name}</span>
                      <span className="ml-4 text-xs text-slate-400">({group.lines.length} {group.lines.length === 1 ? 'item' : 'items'})</span>
                    </td>
                  </tr>
                  {group.lines.map((line) => {
                    const lineTotal = line.quantity * line.sell_price
                    const lineMarginPct = line.sell_price > 0
                      ? ((line.sell_price - line.buy_price) / line.sell_price) * 100
                      : 0
                    const mColor = getMarginColor(line.buy_price, line.sell_price, marginThresholds.green, marginThresholds.amber)
                    const supplier = line.suppliers as { name: string } | null
                    const routeCfg = FULFILMENT_ROUTE_CONFIG?.[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]

                    return (
                      <tr key={line.id} className={`border-t border-slate-100 dark:border-slate-700 ${line.is_optional ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}>
                        <td className="px-5 py-2.5 text-xs text-slate-400 font-mono break-words">
                          {line.products?.sku || '\u2014'}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            {line.product_id ? (
                              <a
                                href={`/products/${line.product_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`hover:text-blue-600 no-underline ${line.is_optional ? 'text-slate-500' : 'font-medium'}`}
                              >
                                {line.description}
                              </a>
                            ) : (
                              <span className={line.is_optional ? 'text-slate-500' : 'font-medium'}>{line.description}</span>
                            )}
                            {line.deal_reg_line_id && (
                              <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-2.5">
                          {routeCfg ? (
                            <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
                          ) : (
                            <span className="text-xs text-slate-400">{line.fulfilment_route?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '\u2014'}</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500 break-words">{supplier?.name || '\u2014'}</td>
                        <td className="px-5 py-2.5 text-right">{line.quantity}</td>
                        <td className="px-5 py-2.5 text-right">{formatCurrency(line.buy_price)}</td>
                        <td className="px-5 py-2.5 text-right">{formatCurrency(line.sell_price)}</td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          <span className={`font-medium ${mColor}`}>{lineMarginPct.toFixed(1)}%</span>
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex gap-1">
                            {line.is_optional && <Badge label="Optional" color="#6b7280" bg="#f3f4f6" />}
                            {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ungrouped lines */}
        {ungroupedLines.length > 0 && (
          <>
            <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
              <span className="text-sm font-semibold text-slate-500">Ungrouped</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {ungroupedLines.map((line) => {
                    const lineTotal = line.quantity * line.sell_price
                    return (
                      <tr key={line.id} className="border-t border-slate-100">
                        <td className="px-5 py-2.5">
                          {line.product_id ? (
                            <a
                              href={`/products/${line.product_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:text-blue-600 no-underline"
                            >
                              {line.description}
                            </a>
                          ) : (
                            <span className="font-medium">{line.description}</span>
                          )}
                          {line.products?.sku && (
                            <div className="text-xs text-slate-400">{line.products.sku}</div>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right">{line.quantity}</td>
                        <td className="px-5 py-2.5 text-right">{formatCurrency(line.sell_price)}</td>
                        <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Change Requests */}
      {changeRequests && changeRequests.length > 0 && (
        <ChangeRequestsSection requests={changeRequests} />
      )}

      {/* Activity Timeline */}
      <ActivitySection activities={(activities || []) as { id: string; action: string; created_at: string; users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null }[]} />

      {/* Bottom Edit Button */}
      <QuoteBottomEdit quoteId={quote.id} status={quote.status} version={quote.version} />

      {/* Floating totals bar — sticky within scrollable main area */}
      <div className="sticky bottom-0 z-40 -mx-6 md:-mx-10 lg:-mx-12 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="px-6 md:px-10 lg:px-12 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Margin</span>
            <span className={`font-semibold ${getMarginColor(totalCost, subtotal, marginThresholds.green, marginThresholds.amber)}`}>
              {formatCurrency(marginAmt)} ({marginPct.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">VAT</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <MobileDetector
      mobile={mobileDetail}
      desktop={desktopDetail}
    />
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
