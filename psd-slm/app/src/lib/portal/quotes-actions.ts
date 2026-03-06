'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext, PortalQuote, PortalQuoteLine, PortalQuoteGroup } from './types'

const SO_STATUS_MAP: Record<string, string> = {
  draft: 'Processing',
  confirmed: 'Confirmed',
  picking: 'Being Prepared',
  partially_delivered: 'Partially Delivered',
  delivered: 'Delivered',
  invoiced: 'Complete',
}

function mapPortalStatus(status: string): string {
  return SO_STATUS_MAP[status] || status
}

export async function getPortalQuotes(ctx: PortalContext): Promise<PortalQuote[]> {
  const supabase = createAdminClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, title, status, created_at, valid_until,
      customer_notes, vat_rate,
      quote_lines(quantity, sell_price, is_optional, is_hidden_service)
    `)
    .eq('company_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'accepted', 'declined', 'expired'])
    .order('created_at', { ascending: false })

  return (quotes || []).map((q) => {
    const lines = (q.quote_lines || []) as unknown as {
      quantity: number
      sell_price: number
      is_optional: boolean
      is_hidden_service: boolean
    }[]
    const visibleLines = lines.filter((l) => !l.is_hidden_service && !l.is_optional)
    const totalExVat = visibleLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
    const vatRate = q.vat_rate ?? 20

    return {
      id: q.id,
      quoteNumber: q.quote_number,
      title: q.title || null,
      status: q.status,
      createdAt: q.created_at,
      validUntil: q.valid_until,
      customerNotes: q.customer_notes,
      totalExVat,
      totalIncVat: totalExVat * (1 + vatRate / 100),
      vatRate,
    }
  })
}

export async function getPortalQuoteDetail(
  quoteId: string,
  ctx: PortalContext
): Promise<{ quote: PortalQuote; lines: PortalQuoteLine[]; groups: PortalQuoteGroup[] } | null> {
  const supabase = createAdminClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, title, status, created_at, valid_until,
      customer_notes, vat_rate,
      quote_groups(id, name, sort_order),
      quote_lines(
        id, group_id, description, quantity, sell_price,
        is_optional, sort_order, is_hidden_service,
        products(product_type)
      )
    `)
    .eq('id', quoteId)
    .eq('company_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!quote) return null

  const rawLines = (quote.quote_lines || []) as unknown as {
    id: string
    group_id: string | null
    description: string
    quantity: number
    sell_price: number
    is_optional: boolean
    sort_order: number
    is_hidden_service: boolean
    products: { product_type: string } | null
  }[]

  // Filter hidden service lines (services with £0 sell price)
  const filteredLines = rawLines.filter(
    (l) => !(l.products?.product_type === 'service' && l.sell_price === 0)
  )

  const groups = ((quote.quote_groups || []) as unknown as { id: string; name: string; sort_order: number }[])
    .map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Get group names map
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  const lines: PortalQuoteLine[] = filteredLines
    .map((l) => ({
      id: l.id,
      groupId: l.group_id,
      groupName: l.group_id ? groupMap.get(l.group_id) || null : null,
      description: l.description,
      quantity: l.quantity,
      sellPrice: l.sell_price,
      isOptional: l.is_optional,
      sortOrder: l.sort_order,
      isHiddenService: l.is_hidden_service,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const visibleLines = lines.filter((l) => !l.isHiddenService && !l.isOptional)
  const totalExVat = visibleLines.reduce((s, l) => s + l.quantity * l.sellPrice, 0)
  const vatRate = quote.vat_rate ?? 20

  return {
    quote: {
      id: quote.id,
      quoteNumber: quote.quote_number,
      title: quote.title || null,
      status: quote.status,
      createdAt: quote.created_at,
      validUntil: quote.valid_until,
      customerNotes: quote.customer_notes,
      totalExVat,
      totalIncVat: totalExVat * (1 + vatRate / 100),
      vatRate,
    },
    lines,
    groups,
  }
}

export async function acceptPortalQuote(
  quoteId: string,
  poNumber: string,
  ctx: PortalContext
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  // Verify ownership and status
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, status, company_id')
    .eq('id', quoteId)
    .eq('company_id', ctx.customerId)
    .eq('status', 'sent')
    .single()

  if (!quote) return { error: 'Quote not found or cannot be accepted' }

  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'accepted',
      customer_po: poNumber,
      accepted_at: new Date().toISOString(),
      accepted_by_type: 'customer_portal',
    })
    .eq('id', quoteId)

  if (error) return { error: error.message }

  // Log activity
  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'quote',
      entity_id: quoteId,
      action: 'accepted',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
      details: { po_number: poNumber, via: 'customer_portal' },
    })
    .then(() => {})

  return { error: null }
}

export async function declinePortalQuote(
  quoteId: string,
  reason: string | null,
  ctx: PortalContext
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, status, company_id')
    .eq('id', quoteId)
    .eq('company_id', ctx.customerId)
    .eq('status', 'sent')
    .single()

  if (!quote) return { error: 'Quote not found or cannot be declined' }

  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'declined',
      decline_reason: reason,
    })
    .eq('id', quoteId)

  if (error) return { error: error.message }

  supabase
    .from('activity_log')
    .insert({
      org_id: ctx.orgId,
      entity_type: 'quote',
      entity_id: quoteId,
      action: 'declined',
      actor_type: 'portal_user',
      portal_user_id: ctx.portalUserId,
      details: { reason, via: 'customer_portal' },
    })
    .then(() => {})

  return { error: null }
}
