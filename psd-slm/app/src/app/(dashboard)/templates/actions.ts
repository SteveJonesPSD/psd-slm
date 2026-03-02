'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { createQuote, type GroupInput, type LineInput, type AttributionInput } from '../quotes/actions'

// --- Types ---

export interface TemplateGroupInput {
  tempId: string
  name: string
  sort_order: number
}

export interface TemplateLineInput {
  tempGroupId: string
  product_id: string | null
  supplier_id: string | null
  sort_order: number
  description: string
  quantity: number
  default_buy_price: number
  default_sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  is_optional: boolean
  requires_contract: boolean
  notes: string | null
}

// --- Create ---

export async function createTemplate(
  formData: FormData,
  groups: TemplateGroupInput[],
  lines: TemplateLineInput[]
) {
  const user = await requirePermission('templates', 'create')
  const supabase = await createClient()

  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Template name is required' }
  if (lines.length === 0) return { error: 'At least one line item is required' }

  const { data: template, error } = await supabase
    .from('quote_templates')
    .insert({
      org_id: user.orgId,
      name: name.trim(),
      description: (formData.get('description') as string) || null,
      category: (formData.get('category') as string) || null,
      default_quote_type: (formData.get('default_quote_type') as string) || null,
      is_active: formData.get('is_active') !== 'false',
      created_by: user.id,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert groups and build tempId→realId map
  const groupMap = new Map<string, string>()

  if (groups.length > 0) {
    const groupRows = groups.map((g) => ({
      template_id: template.id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: insertedGroups, error: groupsError } = await supabase
      .from('quote_template_groups')
      .insert(groupRows)
      .select()

    if (groupsError) {
      await supabase.from('quote_templates').delete().eq('id', template.id)
      return { error: groupsError.message }
    }

    groups.forEach((g, i) => {
      if (insertedGroups[i]) {
        groupMap.set(g.tempId, insertedGroups[i].id)
      }
    })
  }

  // Insert lines
  const lineRows = lines.map((l) => ({
    template_id: template.id,
    group_id: groupMap.get(l.tempGroupId) || null,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || null,
    sort_order: l.sort_order,
    description: l.description,
    quantity: l.quantity,
    default_buy_price: l.default_buy_price,
    default_sell_price: l.default_sell_price,
    fulfilment_route: l.fulfilment_route,
    is_optional: l.is_optional,
    requires_contract: l.requires_contract,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase
    .from('quote_template_lines')
    .insert(lineRows)

  if (linesError) {
    await supabase.from('quote_templates').delete().eq('id', template.id)
    return { error: linesError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote_template',
    entityId: template.id,
    action: 'created',
    details: { name, line_count: lines.length },
  })

  revalidatePath('/templates')
  return { data: template }
}

// --- Update ---

export async function updateTemplate(
  id: string,
  formData: FormData,
  groups: TemplateGroupInput[],
  lines: TemplateLineInput[]
) {
  const user = await requirePermission('templates', 'edit')
  const supabase = await createClient()

  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Template name is required' }
  if (lines.length === 0) return { error: 'At least one line item is required' }

  const { error } = await supabase
    .from('quote_templates')
    .update({
      name: name.trim(),
      description: (formData.get('description') as string) || null,
      category: (formData.get('category') as string) || null,
      default_quote_type: (formData.get('default_quote_type') as string) || null,
      is_active: formData.get('is_active') !== 'false',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Delete-and-reinsert children
  await supabase.from('quote_template_lines').delete().eq('template_id', id)
  await supabase.from('quote_template_groups').delete().eq('template_id', id)

  // Re-insert groups
  const groupMap = new Map<string, string>()
  if (groups.length > 0) {
    const groupRows = groups.map((g) => ({
      template_id: id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: insertedGroups, error: groupsError } = await supabase
      .from('quote_template_groups')
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
    template_id: id,
    group_id: groupMap.get(l.tempGroupId) || null,
    product_id: l.product_id || null,
    supplier_id: l.supplier_id || null,
    sort_order: l.sort_order,
    description: l.description,
    quantity: l.quantity,
    default_buy_price: l.default_buy_price,
    default_sell_price: l.default_sell_price,
    fulfilment_route: l.fulfilment_route,
    is_optional: l.is_optional,
    requires_contract: l.requires_contract,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase
    .from('quote_template_lines')
    .insert(lineRows)

  if (linesError) return { error: linesError.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote_template',
    entityId: id,
    action: 'updated',
    details: { name, line_count: lines.length },
  })

  revalidatePath('/templates')
  revalidatePath(`/templates/${id}`)
  return { success: true }
}

// --- Delete (soft) ---

export async function deleteTemplate(id: string) {
  const user = await requirePermission('templates', 'delete')
  const supabase = await createClient()

  const { data: template } = await supabase
    .from('quote_templates')
    .select('name')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('quote_templates')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'quote_template',
    entityId: id,
    action: 'deleted',
    details: { name: template?.name },
  })

  revalidatePath('/templates')
  return { success: true }
}

// --- Clone Template to Quote ---

export async function cloneTemplateToQuote(
  templateId: string,
  customerId: string,
  opts?: {
    contactId?: string
    opportunityId?: string
    brandId?: string
    assignedTo?: string
  }
) {
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

  // Fetch template with children
  const { data: template } = await supabase
    .from('quote_templates')
    .select('*, quote_template_groups(*), quote_template_lines(*)')
    .eq('id', templateId)
    .single()

  if (!template) return { error: 'Template not found' }

  // Fetch deal pricing for the target customer
  const { data: dealPricing } = await supabase
    .from('v_active_deal_pricing')
    .select('*')
    .eq('customer_id', customerId)

  // Fetch product_suppliers for preferred supplier fallback
  const templateLines = template.quote_template_lines as {
    group_id: string | null; product_id: string | null; supplier_id: string | null;
    sort_order: number; description: string; quantity: number;
    default_buy_price: number; default_sell_price: number;
    fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null
  }[]

  const productIds = templateLines.filter((l) => l.product_id).map((l) => l.product_id!)
  const { data: productSuppliers } = productIds.length > 0
    ? await supabase
        .from('product_suppliers')
        .select('product_id, supplier_id, standard_cost, is_preferred')
        .in('product_id', productIds)
        .eq('is_preferred', true)
    : { data: [] as { product_id: string; supplier_id: string; standard_cost: number | null; is_preferred: boolean }[] }

  // Build groups
  const templateGroups = template.quote_template_groups as { id: string; name: string; sort_order: number }[]
  const oldGroupToTemp = new Map<string, string>()

  const groups: GroupInput[] = templateGroups.map((g) => {
    const tempId = crypto.randomUUID()
    oldGroupToTemp.set(g.id, tempId)
    return { tempId, name: g.name, sort_order: g.sort_order }
  })

  // Ensure at least one group
  if (groups.length === 0) {
    const tempId = crypto.randomUUID()
    groups.push({ tempId, name: 'General', sort_order: 0 })
  }

  // Build lines with deal-reg pricing logic
  const lines: LineInput[] = templateLines.map((l) => {
    let buy_price = l.default_buy_price
    let supplier_id = l.supplier_id
    let deal_reg_line_id: string | null = null

    if (l.product_id && dealPricing) {
      const dealReg = dealPricing.find((dp) => dp.product_id === l.product_id)
      if (dealReg) {
        buy_price = dealReg.deal_cost
        supplier_id = dealReg.supplier_id
        deal_reg_line_id = dealReg.deal_reg_line_id
      } else if (productSuppliers) {
        const preferred = productSuppliers.find((ps) => ps.product_id === l.product_id && ps.is_preferred)
        if (preferred) {
          supplier_id = preferred.supplier_id
          if (preferred.standard_cost != null) {
            buy_price = preferred.standard_cost
          }
        }
      }
    }

    const tempGroupId = l.group_id
      ? (oldGroupToTemp.get(l.group_id) || groups[0].tempId)
      : groups[0].tempId

    return {
      tempGroupId,
      product_id: l.product_id,
      supplier_id,
      deal_reg_line_id,
      sort_order: l.sort_order,
      description: l.description,
      quantity: l.quantity,
      buy_price,
      sell_price: l.default_sell_price,
      fulfilment_route: l.fulfilment_route as 'from_stock' | 'drop_ship',
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
    }
  })

  // Default attribution: 100% direct to current user
  const attributions: AttributionInput[] = [
    { user_id: opts?.assignedTo || user.id, attribution_type: 'direct', split_pct: 100 },
  ]

  // Build FormData for createQuote
  const formData = new FormData()
  formData.set('customer_id', customerId)
  formData.set('contact_id', opts?.contactId || '')
  formData.set('opportunity_id', opts?.opportunityId || '')
  formData.set('assigned_to', opts?.assignedTo || user.id)
  formData.set('brand_id', opts?.brandId || '')
  formData.set('quote_type', template.default_quote_type || '')
  formData.set('valid_until', '')
  formData.set('vat_rate', '20')
  formData.set('customer_notes', '')
  formData.set('internal_notes', `Created from template: ${template.name}`)

  const result = await createQuote(formData, groups, lines, attributions)

  if ('data' in result && result.data) {
    logActivity({
      supabase,
      user,
      entityType: 'quote_template',
      entityId: templateId,
      action: 'cloned to quote',
      details: {
        template_name: template.name,
        quote_id: result.data.id,
        customer_id: customerId,
      },
    })
  }

  return result
}

// --- Save Quote as Template ---

export async function saveQuoteAsTemplate(
  quoteId: string,
  name: string,
  description?: string,
  category?: string
) {
  const user = await requirePermission('templates', 'create')
  const supabase = await createClient()

  if (!name?.trim()) return { error: 'Template name is required' }

  // Fetch quote with children
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, quote_groups(*), quote_lines(*)')
    .eq('id', quoteId)
    .single()

  if (!quote) return { error: 'Quote not found' }

  // Create template header
  const { data: template, error } = await supabase
    .from('quote_templates')
    .insert({
      org_id: user.orgId,
      name: name.trim(),
      description: description || null,
      category: category || null,
      default_quote_type: quote.quote_type || null,
      is_active: true,
      created_by: user.id,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Map quote groups to template groups
  const quoteGroups = quote.quote_groups as { id: string; name: string; sort_order: number }[]
  const groupIdMap = new Map<string, string>()

  if (quoteGroups.length > 0) {
    const groupRows = quoteGroups.map((g) => ({
      template_id: template.id,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const { data: insertedGroups, error: groupsError } = await supabase
      .from('quote_template_groups')
      .insert(groupRows)
      .select()

    if (groupsError) {
      await supabase.from('quote_templates').delete().eq('id', template.id)
      return { error: groupsError.message }
    }

    quoteGroups.forEach((g, i) => {
      if (insertedGroups[i]) {
        groupIdMap.set(g.id, insertedGroups[i].id)
      }
    })
  }

  // Map quote lines to template lines, using catalogue defaults
  const quoteLines = quote.quote_lines as {
    group_id: string | null; product_id: string | null; supplier_id: string | null;
    sort_order: number; description: string; quantity: number;
    buy_price: number; sell_price: number;
    fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null
  }[]

  // Fetch catalogue defaults for products on the quote
  const lineProductIds = quoteLines.filter((l) => l.product_id).map((l) => l.product_id!)
  const { data: products } = lineProductIds.length > 0
    ? await supabase
        .from('products')
        .select('id, default_buy_price, default_sell_price')
        .in('id', lineProductIds)
    : { data: [] as { id: string; default_buy_price: number | null; default_sell_price: number | null }[] }

  const productMap = new Map(products?.map((p) => [p.id, p]) || [])

  if (quoteLines.length > 0) {
    const lineRows = quoteLines.map((l) => {
      const catalogueProduct = l.product_id ? productMap.get(l.product_id) : null
      return {
        template_id: template.id,
        group_id: l.group_id ? (groupIdMap.get(l.group_id) || null) : null,
        product_id: l.product_id,
        supplier_id: l.supplier_id,
        sort_order: l.sort_order,
        description: l.description,
        quantity: l.quantity,
        // Use catalogue defaults, falling back to quote prices
        default_buy_price: catalogueProduct?.default_buy_price ?? l.buy_price,
        default_sell_price: catalogueProduct?.default_sell_price ?? l.sell_price,
        fulfilment_route: l.fulfilment_route,
        is_optional: l.is_optional,
        requires_contract: l.requires_contract,
        notes: l.notes,
      }
    })

    const { error: linesError } = await supabase
      .from('quote_template_lines')
      .insert(lineRows)

    if (linesError) {
      await supabase.from('quote_templates').delete().eq('id', template.id)
      return { error: linesError.message }
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'quote_template',
    entityId: template.id,
    action: 'created',
    details: { name, source_quote_id: quoteId, line_count: quoteLines.length },
  })

  revalidatePath('/templates')
  return { data: template }
}
