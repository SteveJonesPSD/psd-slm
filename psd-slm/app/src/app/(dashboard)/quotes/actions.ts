'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { addBusinessDays } from '@/lib/utils'
import { recalcOpportunityValue } from '@/lib/opportunity-value'

// --- Quote validity helper ---

async function getDefaultValidUntil(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', orgId)
    .eq('category', 'general')
    .eq('setting_key', 'quote_validity_days')
    .single()
  const days = parseInt(data?.setting_value ?? '14', 10) || 14
  return addBusinessDays(new Date(), days)
}

// --- Types for structured data passed from the form ---

export interface GroupInput {
  tempId: string
  name: string
  sort_order: number
}

export interface LineInput {
  tempGroupId: string
  product_id: string | null
  supplier_id: string | null
  deal_reg_line_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  is_optional: boolean
  requires_contract: boolean
  notes: string | null
}

export interface AttributionInput {
  user_id: string
  attribution_type: 'direct' | 'involvement' | 'override'
  split_pct: number
}

// --- Helpers ---

async function generateQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`

  // Query base_quote_number to avoid versioned suffixes (e.g. -v2) breaking the sequence parser
  const { data: existing } = await supabase
    .from('quotes')
    .select('base_quote_number')
    .eq('org_id', orgId)
    .like('base_quote_number', `${prefix}%`)
    .order('base_quote_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].base_quote_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// --- Create ---

export async function createQuote(
  formData: FormData,
  groups: GroupInput[],
  lines: LineInput[],
  attributions: AttributionInput[]
) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  if (!customer_id) return { error: 'Customer is required' }
  if (lines.length === 0) return { error: 'At least one line item is required' }

  // Validate attribution totals
  const totalPct = attributions.reduce((sum, a) => sum + a.split_pct, 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    return { error: `Attribution must total 100% (currently ${totalPct}%)` }
  }

  const quote_number = await generateQuoteNumber(supabase, user.orgId)
  const portal_token = crypto.randomUUID()

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id,
      contact_id: (formData.get('contact_id') as string) || null,
      opportunity_id: (formData.get('opportunity_id') as string) || null,
      assigned_to: (formData.get('assigned_to') as string) || user.id,
      brand_id: (formData.get('brand_id') as string) || null,
      quote_number,
      base_quote_number: quote_number,
      status: 'draft',
      version: 1,
      title: (formData.get('title') as string) || null,
      quote_type: (formData.get('quote_type') as string) || null,
      valid_until: (formData.get('valid_until') as string) || await getDefaultValidUntil(supabase, user.orgId),
      vat_rate: parseFloat(formData.get('vat_rate') as string) || 20,
      customer_notes: (formData.get('customer_notes') as string) || null,
      internal_notes: (formData.get('internal_notes') as string) || null,
      revision_notes: (formData.get('revision_notes') as string) || null,
      portal_token,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert groups and build tempId→realId map
  const groupMap = new Map<string, string>()

  if (groups.length > 0) {
    const groupRows = groups.map((g) => ({
      quote_id: quote.id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: insertedGroups, error: groupsError } = await supabase
      .from('quote_groups')
      .insert(groupRows)
      .select()

    if (groupsError) {
      await supabase.from('quotes').delete().eq('id', quote.id)
      return { error: groupsError.message }
    }

    // Map tempIds to real ids by sort_order (groups inserted in order)
    groups.forEach((g, i) => {
      if (insertedGroups[i]) {
        groupMap.set(g.tempId, insertedGroups[i].id)
      }
    })
  }

  // Insert lines
  const lineRows = lines.map((l) => ({
    quote_id: quote.id,
    group_id: groupMap.get(l.tempGroupId) || null,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || null,
    deal_reg_line_id: l.deal_reg_line_id || null,
    sort_order: l.sort_order,
    description: l.description,
    quantity: l.quantity,
    buy_price: l.buy_price,
    sell_price: l.sell_price,
    fulfilment_route: l.fulfilment_route,
    is_optional: l.is_optional,
    requires_contract: l.requires_contract,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase
    .from('quote_lines')
    .insert(lineRows)

  if (linesError) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { error: linesError.message }
  }

  // Insert attributions
  if (attributions.length > 0) {
    const attrRows = attributions.map((a) => ({
      quote_id: quote.id,
      user_id: a.user_id,
      attribution_type: a.attribution_type,
      split_pct: a.split_pct,
    }))

    const { error: attrError } = await supabase
      .from('quote_attributions')
      .insert(attrRows)

    if (attrError) {
      await supabase.from('quotes').delete().eq('id', quote.id)
      return { error: attrError.message }
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: quote.id,
    action: 'created',
    details: { quote_number, customer_id, line_count: lines.length },
  })

  revalidatePath('/quotes')
  return { data: quote }
}

// --- Update ---

export async function updateQuote(
  id: string,
  formData: FormData,
  groups: GroupInput[],
  lines: LineInput[],
  attributions: AttributionInput[]
) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'quotes', 'edit_all')
  const canEditOwn = hasPermission(user, 'quotes', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: quotes.edit')
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  if (!customer_id) return { error: 'Customer is required' }
  if (lines.length === 0) return { error: 'At least one line item is required' }

  const totalPct = attributions.reduce((sum, a) => sum + a.split_pct, 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    return { error: `Attribution must total 100% (currently ${totalPct}%)` }
  }

  // Update quote header
  const { error } = await supabase
    .from('quotes')
    .update({
      customer_id,
      contact_id: (formData.get('contact_id') as string) || null,
      opportunity_id: (formData.get('opportunity_id') as string) || null,
      assigned_to: (formData.get('assigned_to') as string) || null,
      brand_id: (formData.get('brand_id') as string) || null,
      title: (formData.get('title') as string) || null,
      quote_type: (formData.get('quote_type') as string) || null,
      valid_until: (formData.get('valid_until') as string) || null,
      vat_rate: parseFloat(formData.get('vat_rate') as string) || 20,
      customer_notes: (formData.get('customer_notes') as string) || null,
      internal_notes: (formData.get('internal_notes') as string) || null,
      revision_notes: (formData.get('revision_notes') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Delete-and-reinsert children (established pattern)
  await supabase.from('quote_attributions').delete().eq('quote_id', id)
  await supabase.from('quote_lines').delete().eq('quote_id', id)
  await supabase.from('quote_groups').delete().eq('quote_id', id)

  // Re-insert groups
  const groupMap = new Map<string, string>()
  if (groups.length > 0) {
    const groupRows = groups.map((g) => ({
      quote_id: id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: insertedGroups, error: groupsError } = await supabase
      .from('quote_groups')
      .insert(groupRows)
      .select()

    if (groupsError) return { error: groupsError.message }

    groups.forEach((g, i) => {
      if (insertedGroups[i]) {
        groupMap.set(g.tempId, insertedGroups[i].id)
      }
    })
  }

  // Re-insert lines
  const lineRows = lines.map((l) => ({
    quote_id: id,
    group_id: groupMap.get(l.tempGroupId) || null,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || null,
    deal_reg_line_id: l.deal_reg_line_id || null,
    sort_order: l.sort_order,
    description: l.description,
    quantity: l.quantity,
    buy_price: l.buy_price,
    sell_price: l.sell_price,
    fulfilment_route: l.fulfilment_route,
    is_optional: l.is_optional,
    requires_contract: l.requires_contract,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase.from('quote_lines').insert(lineRows)
  if (linesError) return { error: linesError.message }

  // Re-insert attributions
  if (attributions.length > 0) {
    const attrRows = attributions.map((a) => ({
      quote_id: id,
      user_id: a.user_id,
      attribution_type: a.attribution_type,
      split_pct: a.split_pct,
    }))

    const { error: attrError } = await supabase.from('quote_attributions').insert(attrRows)
    if (attrError) return { error: attrError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: id,
    action: 'updated',
    details: { customer_id, line_count: lines.length },
  })

  // Recalc opportunity value if linked
  const opportunityId = (formData.get('opportunity_id') as string) || null
  await recalcOpportunityValue(supabase, opportunityId)

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`)
  return { success: true }
}

// --- Delete ---

export async function deleteQuote(id: string) {
  const user = await requirePermission('quotes', 'delete')
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('quote_number, opportunity_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: id,
    action: 'deleted',
    details: { quote_number: quote?.quote_number },
  })

  // Recalc opportunity value if was linked
  if (quote?.opportunity_id) {
    await recalcOpportunityValue(supabase, quote.opportunity_id)
    revalidatePath(`/opportunities/${quote.opportunity_id}`)
  }

  revalidatePath('/quotes')
  return { success: true }
}

// --- Duplicate ---

export async function duplicateQuote(id: string) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  const { data: original } = await supabase
    .from('quotes')
    .select('*, quote_groups(*), quote_lines(*), quote_attributions(*)')
    .eq('id', id)
    .single()

  if (!original) return { error: 'Quote not found' }

  const quote_number = await generateQuoteNumber(supabase, user.orgId)
  const portal_token = crypto.randomUUID()

  // Duplicate creates a blank quote with only line items (and groups).
  // Customer, contact, opportunity, notes, and deal reg links are stripped
  // so the quote can be raised for a different customer.
  const { data: newQuote, error } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id: original.customer_id, // kept (NOT NULL) — user changes in builder
      contact_id: null,
      opportunity_id: null,
      assigned_to: user.id,
      quote_number,
      base_quote_number: quote_number,
      status: 'draft',
      version: 1,
      quote_type: original.quote_type,
      valid_until: await getDefaultValidUntil(supabase, user.orgId),
      vat_rate: original.vat_rate,
      customer_notes: null,
      internal_notes: null,
      portal_token,
      brand_id: original.brand_id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Copy groups
  const groups = original.quote_groups as { name: string; sort_order: number }[]
  const oldLines = original.quote_lines as { group_id: string | null; product_id: string | null; supplier_id: string | null; deal_reg_line_id: string | null; sort_order: number; description: string; quantity: number; buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null }[]
  const oldGroupIdMap = new Map<string, string>()

  if (groups.length > 0) {
    const originalGroups = original.quote_groups as { id: string; name: string; sort_order: number }[]

    const groupRows = groups.map((g) => ({
      quote_id: newQuote.id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: newGroups } = await supabase
      .from('quote_groups')
      .insert(groupRows)
      .select()

    if (newGroups) {
      originalGroups.forEach((og, i) => {
        if (newGroups[i]) {
          oldGroupIdMap.set(og.id, newGroups[i].id)
        }
      })
    }
  }

  // Copy lines — strip deal_reg_line_id (customer-specific pricing)
  if (oldLines.length > 0) {
    const lineRows = oldLines.map((l) => ({
      quote_id: newQuote.id,
      group_id: l.group_id ? (oldGroupIdMap.get(l.group_id) || null) : null,
      product_id: l.product_id,
      supplier_id: l.supplier_id,
      deal_reg_line_id: null,
      sort_order: l.sort_order,
      description: l.description,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      fulfilment_route: l.fulfilment_route,
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
    }))

    await supabase.from('quote_lines').insert(lineRows)
  }

  // Default attribution: 100% direct to current user
  await supabase.from('quote_attributions').insert({
    quote_id: newQuote.id,
    user_id: user.id,
    attribution_type: 'direct',
    split_pct: 100,
  })

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: newQuote.id,
    action: 'created',
    details: { quote_number, duplicated_from: id },
  })

  revalidatePath('/quotes')
  return { data: newQuote }
}

// --- Create Revision ---

export async function createRevision(id: string, revisionNotes?: string) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  const { data: original } = await supabase
    .from('quotes')
    .select('*, quote_groups(*), quote_lines(*), quote_attributions(*)')
    .eq('id', id)
    .single()

  if (!original) return { error: 'Quote not found' }

  // Guard against revising draft quotes — use direct edit instead
  if (original.status === 'draft' || original.status === 'review') {
    return { error: 'Draft/review quotes should be edited directly, not revised.' }
  }

  const portal_token = crypto.randomUUID()
  const newVersion = original.version + 1
  const baseNumber = original.base_quote_number || original.quote_number
  const newQuoteNumber = `${baseNumber}-v${newVersion}`

  // Create new version
  const { data: newQuote, error } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id: original.customer_id,
      contact_id: original.contact_id,
      opportunity_id: original.opportunity_id,
      assigned_to: original.assigned_to || user.id,
      quote_number: newQuoteNumber,
      base_quote_number: baseNumber,
      status: 'draft',
      version: newVersion,
      parent_quote_id: original.id,
      title: original.title,
      quote_type: original.quote_type,
      brand_id: original.brand_id,
      valid_until: await getDefaultValidUntil(supabase, user.orgId),
      vat_rate: original.vat_rate,
      customer_notes: original.customer_notes,
      internal_notes: original.internal_notes,
      revised_by: user.id,
      revision_notes: revisionNotes?.trim()
        ? `${user.firstName} ${user.lastName}: ${revisionNotes.trim()}`
        : null,
      portal_token,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Mark original as revised, clear its opportunity link (now on new version)
  await supabase
    .from('quotes')
    .update({
      status: 'revised',
      status_before_revised: original.status,
      opportunity_id: null,
    })
    .eq('id', original.id)

  // Copy groups
  const groups = original.quote_groups as { id: string; name: string; sort_order: number }[]
  const oldGroupIdMap = new Map<string, string>()

  if (groups.length > 0) {
    const groupRows = groups.map((g) => ({
      quote_id: newQuote.id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: newGroups } = await supabase
      .from('quote_groups')
      .insert(groupRows)
      .select()

    if (newGroups) {
      groups.forEach((og, i) => {
        if (newGroups[i]) {
          oldGroupIdMap.set(og.id, newGroups[i].id)
        }
      })
    }
  }

  // Copy lines
  const oldLines = original.quote_lines as { group_id: string | null; product_id: string | null; supplier_id: string | null; deal_reg_line_id: string | null; sort_order: number; description: string; quantity: number; buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null }[]
  if (oldLines.length > 0) {
    const lineRows = oldLines.map((l) => ({
      quote_id: newQuote.id,
      group_id: l.group_id ? (oldGroupIdMap.get(l.group_id) || null) : null,
      product_id: l.product_id,
      supplier_id: l.supplier_id,
      deal_reg_line_id: l.deal_reg_line_id,
      sort_order: l.sort_order,
      description: l.description,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      fulfilment_route: l.fulfilment_route,
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
    }))

    await supabase.from('quote_lines').insert(lineRows)
  }

  // Copy attributions
  const attrs = original.quote_attributions as { user_id: string; attribution_type: string; split_pct: number }[]
  if (attrs.length > 0) {
    const attrRows = attrs.map((a) => ({
      quote_id: newQuote.id,
      user_id: a.user_id,
      attribution_type: a.attribution_type,
      split_pct: a.split_pct,
    }))

    await supabase.from('quote_attributions').insert(attrRows)
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: newQuote.id,
    action: 'created',
    details: {
      quote_number: newQuoteNumber,
      version: newVersion,
      revision_of: id,
    },
  })

  // Recalc opportunity value (new revision now carries the link with potentially different lines)
  await recalcOpportunityValue(supabase, original.opportunity_id)
  if (original.opportunity_id) revalidatePath(`/opportunities/${original.opportunity_id}`)

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
  return { data: newQuote }
}

// --- Reactivate Quote ---

export async function reactivateQuote(id: string) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  // Fetch the target quote — must be revised with a stored previous status
  const { data: target } = await supabase
    .from('quotes')
    .select('id, quote_number, base_quote_number, status, status_before_revised')
    .eq('id', id)
    .single()

  if (!target) return { error: 'Quote not found' }
  if (target.status !== 'revised') return { error: 'Only revised quotes can be reactivated' }
  if (!target.status_before_revised) return { error: 'No previous status stored — cannot reactivate' }

  // Find the current active version(s) in the same family (not revised/superseded)
  const { data: activeVersions } = await supabase
    .from('quotes')
    .select('id, status, opportunity_id')
    .eq('base_quote_number', target.base_quote_number)
    .not('status', 'in', '("revised","superseded")')
    .neq('id', id)

  // Capture the opportunity_id from whichever active version holds it
  let opportunityId: string | null = null
  if (activeVersions && activeVersions.length > 0) {
    for (const av of activeVersions) {
      if (av.opportunity_id) opportunityId = av.opportunity_id
      await supabase
        .from('quotes')
        .update({
          status: 'revised',
          status_before_revised: av.status,
          opportunity_id: null,
        })
        .eq('id', av.id)
    }
  }

  // Promote the target — restore its previous status and take the opportunity link
  await supabase
    .from('quotes')
    .update({
      status: target.status_before_revised,
      status_before_revised: null,
      ...(opportunityId ? { opportunity_id: opportunityId } : {}),
    })
    .eq('id', id)

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: id,
    action: 'reactivated',
    details: {
      quote_number: target.quote_number,
      restored_status: target.status_before_revised,
    },
  })

  // Recalc opportunity value (reactivated quote may have different line values)
  await recalcOpportunityValue(supabase, opportunityId)
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`)

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
  return { success: true }
}

// --- Send to Customer ---

export async function sendQuoteToCustomer(id: string) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('portal_token, quote_number')
    .eq('id', id)
    .single()

  if (!quote) return { error: 'Quote not found' }

  // Ensure portal token exists
  let portalToken = quote.portal_token
  if (!portalToken) {
    portalToken = crypto.randomUUID()
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      portal_token: portalToken,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: id,
    action: 'sent',
    details: { quote_number: quote.quote_number },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
  return { success: true, portalToken }
}

// --- Resolve Change Request ---

export async function resolveChangeRequest(requestId: string, notes: string | null) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  const { error } = await supabase
    .from('quote_change_requests')
    .update({
      status: 'resolved',
      internal_notes: notes,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: error.message }

  revalidatePath('/quotes')
  return { success: true }
}

// --- Manual Accept Quote (internal) ---

export async function manuallyAcceptQuote(quoteId: string, customerPo?: string, acceptedByType: string = 'internal_manual') {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, status, org_id')
    .eq('id', quoteId)
    .single()

  if (!quote) return { error: 'Quote not found' }
  if (quote.status !== 'sent') return { error: 'Only sent quotes can be accepted' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_by_type: acceptedByType,
      acknowledged_at: now,
      acknowledged_by: user.id,
      ...(customerPo ? { customer_po: customerPo } : {}),
    })
    .eq('id', quoteId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: quoteId,
    action: 'quote.manually_accepted',
    details: {
      quote_number: quote.quote_number,
      customer_po: customerPo || null,
      accepted_by_type: acceptedByType,
    },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${quoteId}`)
  return { success: true }
}

// --- Acknowledge Acceptance ---

export async function acknowledgeQuoteAcceptance(quoteId: string) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  // Verify quote is accepted and not yet acknowledged
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, status, acknowledged_at')
    .eq('id', quoteId)
    .single()

  if (!quote) return { error: 'Quote not found' }
  if (quote.status !== 'accepted') return { error: 'Quote is not in accepted status' }
  if (quote.acknowledged_at) return { error: 'Quote has already been acknowledged' }

  const { error } = await supabase
    .from('quotes')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user.id,
    })
    .eq('id', quoteId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: quoteId,
    action: 'acknowledged acceptance',
    details: { quote_number: quote.quote_number },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${quoteId}`)
  return { success: true }
}

// --- Mark as Lost ---

export async function markQuoteAsLost(id: string, reason: string) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'quotes', 'edit_all')
  const canEditOwn = hasPermission(user, 'quotes', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: quotes.edit')
  if (!reason) return { error: 'A reason is required' }
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .eq('id', id)
    .single()

  if (!quote) return { error: 'Quote not found' }
  if (quote.status !== 'sent') return { error: 'Only sent quotes can be marked as lost' }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'lost', decline_reason: reason })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: id,
    action: 'marked as lost',
    details: { quote_number: quote.quote_number, reason },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)
  return { success: true }
}

// --- Seed Data ---

export async function seedQuotes() {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  // Idempotent check
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)

  if (count && count > 0) {
    return { error: 'Quotes already exist. Seed skipped to prevent duplicates.' }
  }

  // Fetch lookups
  const [
    { data: customers },
    { data: products },
    { data: suppliers },
    { data: users },
    { data: opportunities },
    { data: contacts },
    { data: dealPricing },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('org_id', user.orgId),
    supabase.from('products').select('id, sku, name, default_buy_price, default_sell_price').eq('org_id', user.orgId),
    supabase.from('suppliers').select('id, name').eq('org_id', user.orgId),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId),
    supabase.from('opportunities').select('id, title, customer_id').eq('org_id', user.orgId),
    supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
    supabase.from('v_active_deal_pricing').select('*'),
  ])

  const findCustomer = (name: string) => customers?.find((c) => c.name.includes(name))
  const findProduct = (name: string) => products?.find((p) => p.name.includes(name))
  const findSupplier = (name: string) => suppliers?.find((s) => s.name.includes(name))
  const findUser = (firstName: string) => users?.find((u) => u.first_name === firstName)
  const findOpportunity = (title: string) => opportunities?.find((o) => o.title.includes(title))
  const findContact = (customerId: string) => contacts?.find((c) => c.customer_id === customerId)

  const hartwell = findCustomer('Hartwell')
  const meridian = findCustomer('Meridian')
  const mark = findUser('Mark')
  const rachel = findUser('Rachel')

  if (!hartwell || !meridian || !mark) {
    return { error: 'Required lookup data not found. Please seed customers, products, and users first.' }
  }

  let created = 0

  // Quote 1: Hartwell IAQ System — sent status
  {
    const sensirion = findSupplier('Sensirion')
    const ubiquiti = findSupplier('Ubiquiti')
    const excel = findSupplier('Excel')
    const opportunity = findOpportunity('Hartwell') || findOpportunity('IAQ')
    const contact = hartwell ? findContact(hartwell.id) : null

    const sen55 = findProduct('SEN55')
    const co2 = findProduct('CO2')
    const ap = findProduct('Access Point') || findProduct('WiFi')
    const poe = findProduct('PoE') || findProduct('24-Port')
    const cat6a = findProduct('Cat6A Cable')
    const patch = findProduct('Cat6A Patch') || findProduct('Patch')

    const quote_number = await generateQuoteNumber(supabase, user.orgId)

    const { data: q1 } = await supabase
      .from('quotes')
      .insert({
        org_id: user.orgId,
        customer_id: hartwell.id,
        contact_id: contact?.id || null,
        opportunity_id: opportunity?.id || null,
        assigned_to: mark.id,
        quote_number,
        base_quote_number: quote_number,
        status: 'sent',
        version: 1,
        quote_type: 'business',
        valid_until: '2026-04-01',
        vat_rate: 20,
        customer_notes: 'Installation included. 12-month warranty on all hardware.',
        internal_notes: 'High-value opportunity. Fast-track if accepted.',
        portal_token: crypto.randomUUID(),
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (q1) {
      // Create 3 groups
      const { data: g1Groups } = await supabase
        .from('quote_groups')
        .insert([
          { quote_id: q1.id, name: 'IAQ Sensors', sort_order: 0 },
          { quote_id: q1.id, name: 'Network Infrastructure', sort_order: 1 },
          { quote_id: q1.id, name: 'Cabling', sort_order: 2 },
        ])
        .select()

      if (g1Groups) {
        // Find deal pricing for Hartwell
        const getDealLine = (productId: string) =>
          dealPricing?.find((dp) => dp.customer_id === hartwell!.id && dp.product_id === productId)

        const lineData = [
          // IAQ Sensors group
          { group: g1Groups[0], product: sen55, supplier: sensirion, qty: 40, buy: 24, sell: 45, order: 0 },
          { group: g1Groups[0], product: co2, supplier: sensirion, qty: 20, buy: 38, sell: 65, order: 1 },
          // Network Infrastructure group
          { group: g1Groups[1], product: ap, supplier: ubiquiti, qty: 12, buy: 115, sell: 185, order: 0 },
          { group: g1Groups[1], product: poe, supplier: ubiquiti, qty: 3, buy: 310, sell: 495, order: 1 },
          // Cabling group
          { group: g1Groups[2], product: cat6a, supplier: excel, qty: 8, buy: 148, sell: 225, order: 0 },
          { group: g1Groups[2], product: patch, supplier: excel, qty: 100, buy: 2.4, sell: 4.5, order: 1 },
        ]

        const lineRows = lineData
          .filter((l) => l.product)
          .map((l) => {
            const dp = getDealLine(l.product!.id)
            return {
              quote_id: q1.id,
              group_id: l.group.id,
              product_id: l.product!.id,
              supplier_id: l.supplier?.id || null,
              deal_reg_line_id: dp ? dp.deal_reg_line_id : null,
              sort_order: l.order,
              description: l.product!.name,
              quantity: l.qty,
              buy_price: dp ? dp.deal_cost : l.buy,
              sell_price: l.sell,
              fulfilment_route: 'from_stock',
              is_optional: false,
              requires_contract: false,
            }
          })

        await supabase.from('quote_lines').insert(lineRows)
      }

      // Attributions: Mark 80% direct, Rachel 20% involvement
      const attrRows = [
        { quote_id: q1.id, user_id: mark.id, attribution_type: 'direct', split_pct: 80 },
      ]
      if (rachel) {
        attrRows.push({ quote_id: q1.id, user_id: rachel.id, attribution_type: 'involvement', split_pct: 20 })
      } else {
        attrRows[0].split_pct = 100
      }

      await supabase.from('quote_attributions').insert(attrRows)
      created++
    }
  }

  // Quote 2: Meridian SmartClass — draft status
  {
    const ubiquiti = findSupplier('Ubiquiti')
    const opportunity = findOpportunity('Meridian') || findOpportunity('SmartClass')
    const contact = meridian ? findContact(meridian.id) : null
    const ap = findProduct('Access Point') || findProduct('WiFi')
    const poe = findProduct('PoE') || findProduct('24-Port')
    const screen = findProduct('Display') || findProduct('Screen') || findProduct('Interactive')

    const quote_number = await generateQuoteNumber(supabase, user.orgId)

    const { data: q2 } = await supabase
      .from('quotes')
      .insert({
        org_id: user.orgId,
        customer_id: meridian.id,
        contact_id: contact?.id || null,
        opportunity_id: opportunity?.id || null,
        assigned_to: mark.id,
        quote_number,
        base_quote_number: quote_number,
        status: 'draft',
        version: 1,
        quote_type: 'education',
        valid_until: '2026-04-15',
        vat_rate: 20,
        customer_notes: 'All items subject to term-time installation schedule.',
        internal_notes: null,
        portal_token: crypto.randomUUID(),
      })
      .select()
      .single()

    if (q2) {
      const { data: g2Groups } = await supabase
        .from('quote_groups')
        .insert([
          { quote_id: q2.id, name: 'Wireless Network', sort_order: 0 },
          { quote_id: q2.id, name: 'Classroom Technology', sort_order: 1 },
        ])
        .select()

      if (g2Groups) {
        const lineData = [
          { group: g2Groups[0], product: ap, supplier: ubiquiti, qty: 24, buy: 115, sell: 175, order: 0 },
          { group: g2Groups[0], product: poe, supplier: ubiquiti, qty: 3, buy: 310, sell: 465, order: 1 },
          { group: g2Groups[1], product: screen, supplier: null, qty: 6, buy: 850, sell: 1350, order: 0 },
        ]

        const lineRows = lineData
          .filter((l) => l.product)
          .map((l) => ({
            quote_id: q2.id,
            group_id: l.group.id,
            product_id: l.product!.id,
            supplier_id: l.supplier?.id || null,
            deal_reg_line_id: null,
            sort_order: l.order,
            description: l.product!.name,
            quantity: l.qty,
            buy_price: l.buy,
            sell_price: l.sell,
            fulfilment_route: 'from_stock' as const,
            is_optional: false,
            requires_contract: false,
          }))

        await supabase.from('quote_lines').insert(lineRows)
      }

      // Attribution: Mark 100% direct
      await supabase.from('quote_attributions').insert({
        quote_id: q2.id,
        user_id: mark.id,
        attribution_type: 'direct',
        split_pct: 100,
      })

      created++
    }
  }

  revalidatePath('/quotes')
  return { success: true, created }
}

// --- Create from Supplier Import ---

export interface SupplierImportLine {
  product_id: string | null
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  supplier_id: string | null
  product_code: string | null
  manufacturer_part: string | null
}

export interface SupplierImportInput {
  customer_id: string
  contact_id: string | null
  assigned_to: string | null
  brand_id: string | null
  quote_type: string | null
  title: string | null
  supplier_id: string | null
  new_supplier_name: string | null
  group_name: string
  lines: SupplierImportLine[]
  pdf_storage_path: string | null
  pdf_file_name: string | null
  attachment_label?: string
}

export async function createQuoteFromSupplierImport(input: SupplierImportInput) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  if (!input.customer_id) return { error: 'Customer is required' }
  if (input.lines.length === 0) return { error: 'At least one line item is required' }

  // Auto-create supplier if name provided but no ID
  let resolvedSupplierId = input.supplier_id
  if (!resolvedSupplierId && input.new_supplier_name) {
    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        org_id: user.orgId,
        name: input.new_supplier_name.trim(),
        is_active: true,
      })
      .select()
      .single()

    if (supplierError) return { error: `Failed to create supplier: ${supplierError.message}` }
    resolvedSupplierId = newSupplier.id

    logActivity({
      supabase,
      user,
      entityType: 'supplier',
      entityId: newSupplier.id,
      action: 'created',
      details: { name: input.new_supplier_name, source: 'supplier_import' },
    })
  }

  const quote_number = await generateQuoteNumber(supabase, user.orgId)
  const portal_token = crypto.randomUUID()

  // Create quote
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id: input.customer_id,
      contact_id: input.contact_id || null,
      opportunity_id: null,
      assigned_to: input.assigned_to || user.id,
      brand_id: input.brand_id || null,
      quote_number,
      base_quote_number: quote_number,
      status: 'draft',
      version: 1,
      title: input.title || null,
      quote_type: input.quote_type || null,
      valid_until: await getDefaultValidUntil(supabase, user.orgId),
      vat_rate: 20,
      portal_token,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Create a single group
  const { data: group, error: groupError } = await supabase
    .from('quote_groups')
    .insert({
      quote_id: quote.id,
      name: input.group_name || '',
      sort_order: 0,
    })
    .select()
    .single()

  if (groupError) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { error: groupError.message }
  }

  // Auto-create products for unmatched lines
  const lineSupplierId = resolvedSupplierId
  for (const l of input.lines) {
    if (l.product_id) continue // already matched
    const sku = l.product_code || l.manufacturer_part
    if (!sku) continue // no code to use as SKU

    // Check if SKU already exists (may have been created by a previous line in this batch)
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('sku', sku)
      .maybeSingle()

    if (existing) {
      l.product_id = existing.id
      continue
    }

    // Create the product
    const { data: newProduct, error: prodErr } = await supabase
      .from('products')
      .insert({
        org_id: user.orgId,
        sku,
        name: l.description,
        default_buy_price: l.buy_price || null,
        default_sell_price: l.sell_price || null,
        product_type: 'goods',
        is_stocked: false,
      })
      .select('id')
      .single()

    if (prodErr) {
      console.error('[createQuoteFromSupplierImport] Failed to create product:', prodErr)
      continue
    }

    l.product_id = newProduct.id

    // Link to supplier
    if (lineSupplierId) {
      const supplierSku = l.product_code || null
      await supabase.from('product_suppliers').insert({
        product_id: newProduct.id,
        supplier_id: lineSupplierId,
        is_preferred: true,
        supplier_sku: supplierSku,
        standard_cost: l.buy_price || null,
      })
    }

    logActivity({
      supabase,
      user,
      entityType: 'product',
      entityId: newProduct.id,
      action: 'created',
      details: { sku, name: l.description, source: 'supplier_import' },
    })
  }

  // Look up default routes for matched products
  const matchedProductIds = input.lines.map(l => l.product_id).filter(Boolean) as string[]
  const productRouteMap: Record<string, string> = {}
  if (matchedProductIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, default_route')
      .in('id', matchedProductIds)
    for (const p of prods || []) {
      if (p.default_route) productRouteMap[p.id] = p.default_route
    }
  }

  // Insert lines
  const lineRows = input.lines.map((l, i) => ({
    quote_id: quote.id,
    group_id: group.id,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || resolvedSupplierId || null,
    deal_reg_line_id: null,
    sort_order: i,
    description: l.description,
    quantity: l.quantity,
    buy_price: l.buy_price,
    sell_price: l.sell_price,
    fulfilment_route: (l.product_id && productRouteMap[l.product_id]) || 'from_stock' as const,
    is_optional: false,
    requires_contract: false,
    notes: null,
  }))

  const { error: linesError } = await supabase.from('quote_lines').insert(lineRows)

  if (linesError) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { error: linesError.message }
  }

  // Default attribution: 100% direct to current user
  await supabase.from('quote_attributions').insert({
    quote_id: quote.id,
    user_id: user.id,
    attribution_type: 'direct',
    split_pct: 100,
  })

  // Auto-attach supplier file if available (PDF or .eml)
  if (input.pdf_storage_path) {
    const fileName = input.pdf_file_name || 'supplier-quote.pdf'
    const isEml = fileName.toLowerCase().endsWith('.eml')
    await supabase.from('quote_attachments').insert({
      quote_id: quote.id,
      org_id: user.orgId,
      file_name: fileName,
      storage_path: input.pdf_storage_path,
      file_size: 0, // Size not available here; cosmetic field
      mime_type: isEml ? 'message/rfc822' : 'application/pdf',
      uploaded_by: user.id,
      label: input.attachment_label || 'Supplier Quote',
      source: 'supplier_import',
    })
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: quote.id,
    action: 'created',
    details: {
      quote_number,
      customer_id: input.customer_id,
      line_count: input.lines.length,
      source: 'supplier_import',
    },
  })

  revalidatePath('/quotes')
  return { data: quote }
}

// --- Quick Supplier Create (for merge mode) ---

export async function createSupplierQuick(name: string) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      org_id: user.orgId,
      name: name.trim(),
      is_active: true,
    })
    .select('id, name')
    .single()

  if (error) return { error: `Failed to create supplier: ${error.message}` }

  logActivity({
    supabase,
    user,
    entityType: 'supplier',
    entityId: data.id,
    action: 'created',
    details: { name: data.name, source: 'supplier_import_merge' },
  })

  return { data }
}

// --- Attach Supplier PDF to Existing Quote ---

export async function attachSupplierPdfToQuote(
  quoteId: string,
  storagePath: string,
  fileName: string
) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  const { error } = await supabase.from('quote_attachments').insert({
    quote_id: quoteId,
    org_id: user.orgId,
    file_name: fileName,
    storage_path: storagePath,
    file_size: 0,
    mime_type: 'application/pdf',
    uploaded_by: user.id,
    label: 'Supplier Quote',
    source: 'supplier_import',
  })

  if (error) return { error: error.message }
  return { success: true }
}

// --- Add Supplier Lines to Existing Quote (merge from detail page) ---

export interface MergeLinesToQuoteInput {
  quoteId: string
  groupName: string
  supplierId: string | null
  newSupplierName: string | null
  lines: SupplierImportLine[]
  pdfStoragePath: string | null
  pdfFileName: string | null
}

export async function addSupplierLinesToQuote(input: MergeLinesToQuoteInput) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }
  const supabase = await createClient()

  if (input.lines.length === 0) return { error: 'At least one line item is required' }

  // Auto-create supplier if name provided but no ID
  let resolvedSupplierId = input.supplierId
  if (!resolvedSupplierId && input.newSupplierName) {
    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        org_id: user.orgId,
        name: input.newSupplierName.trim(),
        is_active: true,
      })
      .select()
      .single()

    if (supplierError) return { error: `Failed to create supplier: ${supplierError.message}` }
    resolvedSupplierId = newSupplier.id

    logActivity({
      supabase,
      user,
      entityType: 'supplier',
      entityId: newSupplier.id,
      action: 'created',
      details: { name: input.newSupplierName, source: 'supplier_import_merge' },
    })
  }

  // Get current max sort_order for groups on this quote
  const { data: existingGroups } = await supabase
    .from('quote_groups')
    .select('sort_order')
    .eq('quote_id', input.quoteId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextGroupOrder = existingGroups && existingGroups.length > 0
    ? existingGroups[0].sort_order + 1
    : 0

  // Create the new group
  const { data: group, error: groupError } = await supabase
    .from('quote_groups')
    .insert({
      quote_id: input.quoteId,
      name: input.groupName || 'Imported Lines',
      sort_order: nextGroupOrder,
    })
    .select()
    .single()

  if (groupError) return { error: groupError.message }

  // Get current max sort_order for lines on this quote
  const { data: existingLines } = await supabase
    .from('quote_lines')
    .select('sort_order')
    .eq('quote_id', input.quoteId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextLineOrder = existingLines && existingLines.length > 0
    ? existingLines[0].sort_order + 1
    : 0

  // Auto-create products for unmatched lines
  const mergeSupplierId = resolvedSupplierId
  for (const l of input.lines) {
    if (l.product_id) continue
    const sku = l.product_code || l.manufacturer_part
    if (!sku) continue

    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('sku', sku)
      .maybeSingle()

    if (existing) {
      l.product_id = existing.id
      continue
    }

    const { data: newProduct, error: prodErr } = await supabase
      .from('products')
      .insert({
        org_id: user.orgId,
        sku,
        name: l.description,
        default_buy_price: l.buy_price || null,
        default_sell_price: l.sell_price || null,
        product_type: 'goods',
        is_stocked: false,
      })
      .select('id')
      .single()

    if (prodErr) {
      console.error('[addSupplierLinesToQuote] Failed to create product:', prodErr)
      continue
    }

    l.product_id = newProduct.id

    if (mergeSupplierId) {
      await supabase.from('product_suppliers').insert({
        product_id: newProduct.id,
        supplier_id: mergeSupplierId,
        is_preferred: true,
        supplier_sku: l.product_code || null,
        standard_cost: l.buy_price || null,
      })
    }

    logActivity({
      supabase,
      user,
      entityType: 'product',
      entityId: newProduct.id,
      action: 'created',
      details: { sku, name: l.description, source: 'supplier_import_merge' },
    })
  }

  // Look up default routes for matched products
  const mergeProductIds = input.lines.map(l => l.product_id).filter(Boolean) as string[]
  const mergeRouteMap: Record<string, string> = {}
  if (mergeProductIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, default_route')
      .in('id', mergeProductIds)
    for (const p of prods || []) {
      if (p.default_route) mergeRouteMap[p.id] = p.default_route
    }
  }

  // Insert lines
  const lineRows = input.lines.map((l, i) => ({
    quote_id: input.quoteId,
    group_id: group.id,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || resolvedSupplierId || null,
    deal_reg_line_id: null,
    sort_order: nextLineOrder + i,
    description: l.description,
    quantity: l.quantity,
    buy_price: l.buy_price,
    sell_price: l.sell_price,
    fulfilment_route: (l.product_id && mergeRouteMap[l.product_id]) || 'from_stock' as const,
    is_optional: false,
    requires_contract: false,
    notes: null,
  }))

  const { error: linesError } = await supabase.from('quote_lines').insert(lineRows)
  if (linesError) return { error: linesError.message }

  // Attach supplier PDF
  if (input.pdfStoragePath) {
    await supabase.from('quote_attachments').insert({
      quote_id: input.quoteId,
      org_id: user.orgId,
      file_name: input.pdfFileName || 'supplier-quote.pdf',
      storage_path: input.pdfStoragePath,
      file_size: 0,
      mime_type: 'application/pdf',
      uploaded_by: user.id,
      label: 'Supplier Quote',
      source: 'supplier_import',
    })
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: input.quoteId,
    action: 'updated',
    details: {
      source: 'supplier_import_merge',
      lines_added: input.lines.length,
      group_name: input.groupName,
    },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${input.quoteId}`)
  return { success: true }
}

// --- PO Document Download ---

export async function getPoDocumentUrl(quoteId: string) {
  await requirePermission('quotes', 'view')
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('po_document_path')
    .eq('id', quoteId)
    .single()

  if (!quote?.po_document_path) return { error: 'No PO document found' }

  const { data, error } = await supabase.storage
    .from('po-documents')
    .createSignedUrl(quote.po_document_path, 60, {
      download: true,
    })

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// --- Signature Image Download ---

export async function getSignatureImageUrl(quoteId: string) {
  await requirePermission('quotes', 'view')
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('signature_image_path')
    .eq('id', quoteId)
    .single()

  if (!quote?.signature_image_path) return { error: 'No signature found' }

  const { data, error } = await supabase.storage
    .from('e-signatures')
    .createSignedUrl(quote.signature_image_path, 60)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// --- Refresh products for quote builder ---

export async function refreshQuoteBuilderProducts() {
  await requireAuth()
  const supabase = await createClient()

  const [
    { data: rawProducts },
    { data: productSuppliers },
  ] = await Promise.all([
    supabase.from('products').select('id, sku, name, category_id, default_buy_price, default_sell_price, default_route, product_categories(name)').eq('is_active', true).order('name'),
    supabase.from('product_suppliers').select('product_id, supplier_id, standard_cost, is_preferred'),
  ])

  const products = (rawProducts || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category_id: p.category_id,
    category_name: (p.product_categories as unknown as { name: string } | null)?.name || null,
    default_buy_price: p.default_buy_price,
    default_sell_price: p.default_sell_price,
    default_route: p.default_route || 'from_stock',
  }))

  return { products, productSuppliers: productSuppliers || [] }
}
