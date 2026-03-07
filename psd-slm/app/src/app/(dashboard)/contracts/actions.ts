'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import type {
  ContractType,
  CustomerContract,
  CustomerContractWithDetails,
  ContractLine,
  ContractEntitlement,
  ContractRenewal,
  ContractVisitSlot,
  ContractVisitSlotWithDetails,
  FieldEngineer,
} from '@/lib/contracts/types'

// ============================================================
// Contract Number Generation
// ============================================================

async function generateContractNumber(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CON-${year}-`

  const { data } = await supabase
    .from('customer_contracts')
    .select('contract_number')
    .eq('org_id', orgId)
    .like('contract_number', `${prefix}%`)
    .order('contract_number', { ascending: false })
    .limit(1)

  let next = 1
  if (data && data.length > 0) {
    const last = data[0].contract_number
    const num = parseInt(last.replace(prefix, ''), 10)
    if (!isNaN(num)) next = num + 1
  }

  return `${prefix}${String(next).padStart(4, '0')}`
}

// ============================================================
// Contract Types
// ============================================================

export async function getContractTypes(): Promise<ContractType[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('contract_types')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order')
    .order('name')

  if (error) {
    console.error('[contracts] getContractTypes:', error.message)
    return []
  }
  return data || []
}

export async function getContractType(id: string): Promise<ContractType | null> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contract_types')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function createContractType(formData: FormData): Promise<{ error?: string; data?: ContractType }> {
  const user = await requirePermission('contracts', 'edit')
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return { error: 'Only admins can manage contract types' }
  }
  const supabase = await createClient()

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  if (!name?.trim() || !code?.trim()) return { error: 'Name and code are required' }

  const payload = {
    org_id: user.orgId,
    name: name.trim(),
    code: code.trim().toLowerCase(),
    description: (formData.get('description') as string) || null,
    category: (formData.get('category') as string) || 'support',
    default_visit_frequency: (formData.get('default_visit_frequency') as string) || null,
    default_visit_length_hours: formData.get('default_visit_length_hours') ? Number(formData.get('default_visit_length_hours')) : null,
    default_visits_per_year: formData.get('default_visits_per_year') ? Number(formData.get('default_visits_per_year')) : null,
    includes_remote_support: formData.get('includes_remote_support') === 'true',
    includes_telephone: formData.get('includes_telephone') === 'true',
    includes_onsite: formData.get('includes_onsite') === 'true',
    default_sla_plan_id: (formData.get('default_sla_plan_id') as string) || null,
    default_monthly_hours: formData.get('default_monthly_hours') ? Number(formData.get('default_monthly_hours')) : null,
    allowed_schedule_weeks: formData.get('allowed_schedule_weeks') ? JSON.parse(formData.get('allowed_schedule_weeks') as string) : [36, 39],
    is_active: true,
    sort_order: formData.get('sort_order') ? Number(formData.get('sort_order')) : 0,
    // Billing/term fields
    default_term_months: formData.get('default_term_months') ? Number(formData.get('default_term_months')) : null,
    auto_invoice: formData.get('auto_invoice') === 'true',
    invoice_frequency: (formData.get('invoice_frequency') as string) || 'annual',
    default_notice_alert_days: formData.get('default_notice_alert_days') ? Number(formData.get('default_notice_alert_days')) : 180,
    secondary_alert_days: formData.get('secondary_alert_days') ? Number(formData.get('secondary_alert_days')) : 90,
  }

  const { data, error } = await supabase
    .from('contract_types')
    .insert(payload)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_type', entityId: data.id, action: 'created', details: { name: data.name, code: data.code } })
  revalidatePath('/settings/contract-types')
  return { data }
}

export async function updateContractType(id: string, formData: FormData): Promise<{ error?: string; data?: ContractType }> {
  const user = await requirePermission('contracts', 'edit')
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return { error: 'Only admins can manage contract types' }
  }
  const supabase = await createClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const fields = ['name', 'code', 'description', 'category', 'default_visit_frequency'] as const
  for (const f of fields) {
    const v = formData.get(f) as string | null
    if (v !== null) payload[f] = v || null
  }
  const numFields = ['default_visit_length_hours', 'default_visits_per_year', 'default_monthly_hours', 'sort_order', 'default_term_months', 'default_notice_alert_days', 'secondary_alert_days'] as const
  for (const f of numFields) {
    const v = formData.get(f) as string | null
    if (v !== null) payload[f] = v ? Number(v) : null
  }
  // String-or-null fields
  const slaPlanId = formData.get('default_sla_plan_id') as string | null
  if (slaPlanId !== null) payload.default_sla_plan_id = slaPlanId || null
  const invoiceFreq = formData.get('invoice_frequency') as string | null
  if (invoiceFreq !== null) payload.invoice_frequency = invoiceFreq || 'annual'
  const boolFields = ['includes_remote_support', 'includes_telephone', 'includes_onsite', 'is_active', 'auto_invoice'] as const
  for (const f of boolFields) {
    const v = formData.get(f) as string | null
    if (v !== null) payload[f] = v === 'true'
  }
  const asw = formData.get('allowed_schedule_weeks') as string | null
  if (asw) payload.allowed_schedule_weeks = JSON.parse(asw)

  const { data, error } = await supabase
    .from('contract_types')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_type', entityId: id, action: 'updated', details: payload })
  revalidatePath('/settings/contract-types')
  return { data }
}

export async function getActiveContractCountForType(typeId: string): Promise<number> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('customer_contracts')
    .select('*', { count: 'exact', head: true })
    .eq('contract_type_id', typeId)
    .eq('status', 'active')

  if (error) return 0
  return count || 0
}

// ============================================================
// Customer Contracts — Read
// ============================================================

export async function getCustomerContracts(filters?: {
  status?: string
  category?: string
  renewalPeriod?: string
  search?: string
  customerId?: string
}): Promise<CustomerContractWithDetails[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  let query = supabase
    .from('customer_contracts')
    .select(`
      *,
      customers(id, name),
      contract_types(id, name, code, category, default_visit_frequency, default_visit_length_hours, default_visits_per_year, includes_remote_support, includes_telephone, includes_onsite, default_sla_plan_id, default_monthly_hours),
      contacts(id, first_name, last_name),
      visit_calendars(id, name, schedule_weeks),
      sla_plans(id, name)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.renewalPeriod) query = query.eq('renewal_period', filters.renewalPeriod)
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId)

  const { data, error } = await query

  if (error) {
    console.error('[contracts] getCustomerContracts:', error.message)
    return []
  }

  let results = (data || []).map(mapContractRow)

  if (filters?.category) {
    results = results.filter((c) => c.category === filters.category)
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase()
    results = results.filter(
      (c) =>
        c.contract_number.toLowerCase().includes(s) ||
        c.customer_name.toLowerCase().includes(s)
    )
  }

  return results
}

export async function getCustomerContract(id: string): Promise<CustomerContractWithDetails | null> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data: cc, error } = await supabase
    .from('customer_contracts')
    .select(`
      *,
      customers(id, name),
      contract_types(id, name, code, category, default_visit_frequency, default_visit_length_hours, default_visits_per_year, includes_remote_support, includes_telephone, includes_onsite, default_sla_plan_id, default_monthly_hours),
      contacts(id, first_name, last_name),
      visit_calendars(id, name, schedule_weeks),
      sla_plans(id, name)
    `)
    .eq('id', id)
    .single()

  if (error || !cc) return null

  const mapped = mapContractRow(cc)

  // If SLA plan is inherited from type (no direct sla_plan_id), resolve the name
  if (!mapped.sla_plan_id && mapped.effective_sla_plan_id) {
    const { data: slaPlan } = await supabase
      .from('sla_plans')
      .select('name')
      .eq('id', mapped.effective_sla_plan_id)
      .single()
    if (slaPlan) mapped.effective_sla_plan_name = slaPlan.name
  }

  // Fetch lines, entitlements, renewals, visit slots in parallel
  const [linesRes, entitlementsRes, renewalsRes, slotsRes] = await Promise.all([
    supabase
      .from('contract_lines')
      .select('*')
      .eq('customer_contract_id', id)
      .order('sort_order'),
    supabase
      .from('contract_entitlements')
      .select('*')
      .eq('customer_contract_id', id)
      .order('sort_order'),
    supabase
      .from('contract_renewals')
      .select('*, users!contract_renewals_renewed_by_fkey(first_name, last_name)')
      .or(`old_contract_id.eq.${id},new_contract_id.eq.${id}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('contract_visit_slots')
      .select('*, users!contract_visit_slots_engineer_id_fkey(first_name, last_name, initials, color, avatar_url)')
      .eq('customer_contract_id', id)
      .order('sort_order'),
  ])

  mapped.lines = (linesRes.data || []) as ContractLine[]
  mapped.entitlements = (entitlementsRes.data || []) as ContractEntitlement[]
  mapped.renewals = (renewalsRes.data || []).map((r: Record<string, unknown>) => ({
    ...r,
    renewed_by_name: r.users
      ? `${(r.users as Record<string, string>).first_name} ${(r.users as Record<string, string>).last_name}`
      : null,
  })) as ContractRenewal[]
  mapped.visit_slots = (slotsRes.data || []).map((s: Record<string, unknown>) => {
    const eng = s.users as Record<string, string> | null
    return {
      ...s,
      contract_number: mapped.contract_number,
      customer_id: mapped.customer_id,
      customer_name: mapped.customer_name,
      contract_type_name: mapped.contract_type_name,
      contract_type_code: mapped.contract_type_code,
      engineer_name: eng ? `${eng.first_name} ${eng.last_name}` : 'Unknown',
      effective_start_time: (s.override_start_time as string) || (s.default_start_time as string),
      effective_end_time: (s.override_end_time as string) || (s.default_end_time as string),
    }
  }) as ContractVisitSlotWithDetails[]

  return mapped
}

export async function getContractsByCompany(customerId: string): Promise<CustomerContractWithDetails[]> {
  return getCustomerContracts({ customerId })
}

export async function getContractStats(): Promise<{
  activeCount: number
  totalAnnualValue: number
  dueRenewalCount: number
  pendingSignatureCount: number
}> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('status, annual_value, end_date')
    .eq('org_id', user.orgId)

  const all = contracts || []
  const active = all.filter((c) => c.status === 'active')
  const now = new Date()
  const in90Days = new Date()
  in90Days.setDate(in90Days.getDate() + 90)

  return {
    activeCount: active.length,
    totalAnnualValue: active.reduce((s, c) => s + (Number(c.annual_value) || 0), 0),
    dueRenewalCount: active.filter((c) => new Date(c.end_date) <= in90Days).length,
    pendingSignatureCount: all.filter((c) => c.status === 'pending_signature').length,
  }
}

export async function getContractsDueRenewalCount(): Promise<number> {
  const user = await requireAuth()
  if (!hasPermission(user, 'contracts', 'view')) return 0
  const supabase = await createClient()

  const now = new Date()
  const in90Days = new Date()
  in90Days.setDate(in90Days.getDate() + 90)

  const { count } = await supabase
    .from('customer_contracts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .eq('status', 'active')
    .lte('end_date', in90Days.toISOString().split('T')[0])

  return count || 0
}

// ============================================================
// Customer Contracts — Write
// ============================================================

export async function createCustomerContract(formData: FormData): Promise<{ error?: string; data?: CustomerContract }> {
  const user = await requirePermission('contracts', 'create')
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  const contract_type_id = formData.get('contract_type_id') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const renewal_period = formData.get('renewal_period') as string

  if (!customer_id || !contract_type_id || !start_date || !end_date || !renewal_period) {
    return { error: 'Required fields are missing' }
  }

  const contract_number = await generateContractNumber(supabase, user.orgId)

  const payload = {
    org_id: user.orgId,
    customer_id,
    contract_type_id,
    contact_id: (formData.get('contact_id') as string) || null,
    contract_number,
    status: 'draft',
    version: 1,
    start_date,
    end_date,
    renewal_period,
    renewal_month: formData.get('renewal_month') ? Number(formData.get('renewal_month')) : null,
    auto_renew: formData.get('auto_renew') !== 'false',
    annual_value: formData.get('annual_value') ? Number(formData.get('annual_value')) : null,
    billing_frequency: (formData.get('billing_frequency') as string) || 'annually',
    visit_frequency: (formData.get('visit_frequency') as string) || null,
    visit_length_hours: formData.get('visit_length_hours') ? Number(formData.get('visit_length_hours')) : null,
    visits_per_year: formData.get('visits_per_year') ? Number(formData.get('visits_per_year')) : null,
    sla_plan_id: (formData.get('sla_plan_id') as string) || null,
    monthly_hours: formData.get('monthly_hours') ? Number(formData.get('monthly_hours')) : null,
    opportunity_id: (formData.get('opportunity_id') as string) || null,
    quote_id: (formData.get('quote_id') as string) || null,
    calendar_id: (formData.get('calendar_id') as string) || null,
    notes: (formData.get('notes') as string) || null,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('customer_contracts')
    .insert(payload)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract', entityId: data.id, action: 'created', details: { contract_number: data.contract_number, customer_id } })
  revalidatePath('/contracts')
  return { data }
}

export async function updateCustomerContract(id: string, formData: FormData): Promise<{ error?: string; data?: CustomerContract }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const stringFields = ['contact_id', 'renewal_period', 'billing_frequency', 'visit_frequency', 'sla_plan_id', 'calendar_id', 'notes'] as const
  for (const f of stringFields) {
    const v = formData.get(f) as string | null
    if (v !== null) payload[f] = v || null
  }
  const numFields = ['renewal_month', 'annual_value', 'visit_length_hours', 'visits_per_year', 'monthly_hours'] as const
  for (const f of numFields) {
    const v = formData.get(f) as string | null
    if (v !== null) payload[f] = v ? Number(v) : null
  }
  if (formData.get('auto_renew') !== null) payload.auto_renew = formData.get('auto_renew') === 'true'
  if (formData.get('start_date')) payload.start_date = formData.get('start_date')
  if (formData.get('end_date')) payload.end_date = formData.get('end_date')

  const { data, error } = await supabase
    .from('customer_contracts')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract', entityId: id, action: 'updated', details: payload })
  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  return { data }
}

export async function updateContractStatus(id: string, status: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  if (status === 'cancelled' && !['super_admin', 'admin'].includes(user.role.name)) {
    return { error: 'Only admins can cancel contracts' }
  }

  const { error } = await supabase
    .from('customer_contracts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract', entityId: id, action: 'status_changed', details: { status } })
  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  return {}
}

export async function renewContract(id: string, formData: FormData): Promise<{ error?: string; data?: CustomerContract }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  // Fetch old contract
  const { data: old } = await supabase
    .from('customer_contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!old) return { error: 'Contract not found' }
  if (old.status !== 'active') return { error: 'Only active contracts can be renewed' }

  const newStartDate = formData.get('new_start_date') as string
  const newEndDate = formData.get('new_end_date') as string
  const newAnnualValue = formData.get('annual_value') ? Number(formData.get('annual_value')) : old.annual_value
  const notes = (formData.get('notes') as string) || null

  // Generate new contract number
  const contractNumber = await generateContractNumber(supabase, user.orgId)

  // 1. Mark old contract as renewed
  await supabase
    .from('customer_contracts')
    .update({ status: 'renewed', updated_at: new Date().toISOString() })
    .eq('id', id)

  // 2. Create new contract
  const { data: newContract, error: insertError } = await supabase
    .from('customer_contracts')
    .insert({
      org_id: old.org_id,
      customer_id: old.customer_id,
      contract_type_id: old.contract_type_id,
      contact_id: old.contact_id,
      contract_number: contractNumber,
      status: 'draft',
      parent_contract_id: id,
      version: (old.version || 1) + 1,
      visit_frequency: old.visit_frequency,
      visit_length_hours: old.visit_length_hours,
      visits_per_year: old.visits_per_year,
      start_date: newStartDate,
      end_date: newEndDate,
      renewal_period: old.renewal_period,
      renewal_month: old.renewal_month,
      auto_renew: old.auto_renew,
      annual_value: newAnnualValue,
      billing_frequency: old.billing_frequency,
      opportunity_id: null,
      quote_id: null,
      notes,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  // 3. Copy lines
  const { data: oldLines } = await supabase
    .from('contract_lines')
    .select('*')
    .eq('customer_contract_id', id)
    .order('sort_order')

  if (oldLines && oldLines.length > 0) {
    await supabase.from('contract_lines').insert(
      oldLines.map((l) => ({
        customer_contract_id: newContract.id,
        description: l.description,
        unit_type: l.unit_type,
        quantity: l.quantity,
        unit_price_annual: l.unit_price_annual,
        location: l.location,
        product_id: l.product_id,
        sort_order: l.sort_order,
        notes: l.notes,
      }))
    )
  }

  // 4. Copy entitlements
  const { data: oldEntitlements } = await supabase
    .from('contract_entitlements')
    .select('*')
    .eq('customer_contract_id', id)
    .order('sort_order')

  if (oldEntitlements && oldEntitlements.length > 0) {
    await supabase.from('contract_entitlements').insert(
      oldEntitlements.map((e) => ({
        customer_contract_id: newContract.id,
        entitlement_type: e.entitlement_type,
        description: e.description,
        is_included: e.is_included,
        sort_order: e.sort_order,
      }))
    )
  }

  // 5. Copy visit slots
  const { data: oldSlots } = await supabase
    .from('contract_visit_slots')
    .select('*')
    .eq('customer_contract_id', id)
    .order('sort_order')

  if (oldSlots && oldSlots.length > 0) {
    await supabase.from('contract_visit_slots').insert(
      oldSlots.map((s) => ({
        customer_contract_id: newContract.id,
        engineer_id: s.engineer_id,
        cycle_week_numbers: s.cycle_week_numbers,
        day_of_week: s.day_of_week,
        time_slot: s.time_slot,
        default_start_time: s.default_start_time,
        default_end_time: s.default_end_time,
        override_start_time: s.override_start_time,
        override_end_time: s.override_end_time,
        notes: s.notes,
        sort_order: s.sort_order,
      }))
    )
  }

  // 6. Create renewal record
  await supabase.from('contract_renewals').insert({
    old_contract_id: id,
    new_contract_id: newContract.id,
    previous_end_date: old.end_date,
    new_start_date: newStartDate,
    new_end_date: newEndDate,
    previous_annual_value: old.annual_value,
    new_annual_value: newAnnualValue,
    renewal_method: 'manual',
    notes,
    renewed_by: user.id,
  })

  // 7. Log activity on both
  logActivity({ supabase, user, entityType: 'contract', entityId: id, action: 'renewed', details: { new_contract_id: newContract.id } })
  logActivity({ supabase, user, entityType: 'contract', entityId: newContract.id, action: 'created_from_renewal', details: { old_contract_id: id, version: newContract.version } })

  revalidatePath('/contracts')
  return { data: newContract }
}

// ============================================================
// Contract Lines
// ============================================================

export async function addContractLine(contractId: string, formData: FormData): Promise<{ error?: string; data?: ContractLine }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const description = formData.get('description') as string
  if (!description?.trim()) return { error: 'Description is required' }

  // Get next sort_order
  const { data: existing } = await supabase
    .from('contract_lines')
    .select('sort_order')
    .eq('customer_contract_id', contractId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('contract_lines')
    .insert({
      customer_contract_id: contractId,
      description: description.trim(),
      unit_type: (formData.get('unit_type') as string) || null,
      quantity: formData.get('quantity') ? Number(formData.get('quantity')) : 1,
      unit_price_annual: formData.get('unit_price_annual') ? Number(formData.get('unit_price_annual')) : null,
      location: (formData.get('location') as string) || null,
      product_id: (formData.get('product_id') as string) || null,
      notes: (formData.get('notes') as string) || null,
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_line', entityId: data.id, action: 'created', details: { contract_id: contractId, description } })
  revalidatePath(`/contracts/${contractId}`)
  return { data }
}

export async function updateContractLine(id: string, contractId: string, formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const payload: Record<string, unknown> = {}
  if (formData.get('description') !== null) payload.description = formData.get('description')
  if (formData.get('unit_type') !== null) payload.unit_type = (formData.get('unit_type') as string) || null
  if (formData.get('quantity') !== null) payload.quantity = Number(formData.get('quantity')) || 1
  if (formData.get('unit_price_annual') !== null) payload.unit_price_annual = formData.get('unit_price_annual') ? Number(formData.get('unit_price_annual')) : null
  if (formData.get('location') !== null) payload.location = (formData.get('location') as string) || null
  if (formData.get('notes') !== null) payload.notes = (formData.get('notes') as string) || null

  const { error } = await supabase
    .from('contract_lines')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_line', entityId: id, action: 'updated', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function deleteContractLine(id: string, contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_lines')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_line', entityId: id, action: 'deleted', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// ============================================================
// Contract Entitlements
// ============================================================

export async function addEntitlement(contractId: string, formData: FormData): Promise<{ error?: string; data?: ContractEntitlement }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const entitlement_type = formData.get('entitlement_type') as string
  if (!entitlement_type?.trim()) return { error: 'Entitlement type is required' }

  const { data: existing } = await supabase
    .from('contract_entitlements')
    .select('sort_order')
    .eq('customer_contract_id', contractId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('contract_entitlements')
    .insert({
      customer_contract_id: contractId,
      entitlement_type: entitlement_type.trim(),
      description: (formData.get('description') as string) || null,
      is_included: formData.get('is_included') !== 'false',
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_entitlement', entityId: data.id, action: 'created', details: { contract_id: contractId, entitlement_type } })
  revalidatePath(`/contracts/${contractId}`)
  return { data }
}

export async function updateEntitlement(id: string, contractId: string, formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const payload: Record<string, unknown> = {}
  if (formData.get('entitlement_type') !== null) payload.entitlement_type = formData.get('entitlement_type')
  if (formData.get('description') !== null) payload.description = (formData.get('description') as string) || null
  if (formData.get('is_included') !== null) payload.is_included = formData.get('is_included') === 'true'

  const { error } = await supabase
    .from('contract_entitlements')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_entitlement', entityId: id, action: 'updated', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function deleteEntitlement(id: string, contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_entitlements')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_entitlement', entityId: id, action: 'deleted', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// ============================================================
// Contract Visit Slots
// ============================================================

export async function getContractVisitSlots(contractId: string): Promise<ContractVisitSlotWithDetails[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contract_visit_slots')
    .select('*, users!contract_visit_slots_engineer_id_fkey(first_name, last_name, initials, color, avatar_url)')
    .eq('customer_contract_id', contractId)
    .order('sort_order')

  if (error) {
    console.error('[contracts] getContractVisitSlots:', error.message)
    return []
  }

  // Get contract info for the joined fields
  const { data: cc } = await supabase
    .from('customer_contracts')
    .select('contract_number, customer_id, customers(name), contract_types(name, code)')
    .eq('id', contractId)
    .single()

  const customerName = (cc?.customers as unknown as Record<string, string> | null)?.name || 'Unknown'
  const ctName = (cc?.contract_types as unknown as Record<string, string> | null)?.name || 'Unknown'
  const ctCode = (cc?.contract_types as unknown as Record<string, string> | null)?.code || ''

  return (data || []).map((s: Record<string, unknown>) => {
    const eng = s.users as Record<string, string> | null
    return {
      ...s,
      contract_number: cc?.contract_number || '',
      customer_id: cc?.customer_id || '',
      customer_name: customerName,
      contract_type_name: ctName,
      contract_type_code: ctCode,
      engineer_name: eng ? `${eng.first_name} ${eng.last_name}` : 'Unknown',
      effective_start_time: (s.override_start_time as string) || (s.default_start_time as string),
      effective_end_time: (s.override_end_time as string) || (s.default_end_time as string),
    }
  }) as ContractVisitSlotWithDetails[]
}

export async function addVisitSlot(contractId: string, formData: FormData): Promise<{ error?: string; data?: ContractVisitSlot }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const engineer_id = formData.get('engineer_id') as string
  const day_of_week = formData.get('day_of_week') as string
  const time_slot = formData.get('time_slot') as string
  const cycleWeeksRaw = formData.get('cycle_week_numbers') as string

  if (!engineer_id || !day_of_week || !time_slot || !cycleWeeksRaw) {
    return { error: 'Required fields are missing' }
  }

  const cycle_week_numbers = JSON.parse(cycleWeeksRaw) as number[]
  if (cycle_week_numbers.length === 0) {
    return { error: 'At least one cycle week must be selected' }
  }

  // Set default times based on time_slot
  let default_start_time = '08:30'
  let default_end_time = '12:00'
  if (time_slot === 'pm') {
    default_start_time = '12:30'
    default_end_time = '16:00'
  }

  const override_start_time = time_slot === 'custom' ? (formData.get('override_start_time') as string) || null : null
  const override_end_time = time_slot === 'custom' ? (formData.get('override_end_time') as string) || null : null

  // Get next sort_order
  const { data: existing } = await supabase
    .from('contract_visit_slots')
    .select('sort_order')
    .eq('customer_contract_id', contractId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('contract_visit_slots')
    .insert({
      customer_contract_id: contractId,
      engineer_id,
      cycle_week_numbers,
      day_of_week,
      time_slot,
      default_start_time,
      default_end_time,
      override_start_time,
      override_end_time,
      notes: (formData.get('notes') as string) || null,
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_visit_slot', entityId: data.id, action: 'created', details: { contract_id: contractId, engineer_id, day_of_week, cycle_week_numbers } })
  revalidatePath(`/contracts/${contractId}`)
  return { data }
}

export async function updateVisitSlot(id: string, contractId: string, formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (formData.get('engineer_id')) payload.engineer_id = formData.get('engineer_id')
  if (formData.get('day_of_week')) payload.day_of_week = formData.get('day_of_week')

  const time_slot = formData.get('time_slot') as string | null
  if (time_slot) {
    payload.time_slot = time_slot
    if (time_slot === 'am') {
      payload.default_start_time = '08:30'
      payload.default_end_time = '12:00'
      payload.override_start_time = null
      payload.override_end_time = null
    } else if (time_slot === 'pm') {
      payload.default_start_time = '12:30'
      payload.default_end_time = '16:00'
      payload.override_start_time = null
      payload.override_end_time = null
    } else {
      payload.override_start_time = (formData.get('override_start_time') as string) || null
      payload.override_end_time = (formData.get('override_end_time') as string) || null
    }
  }

  const cycleWeeksRaw = formData.get('cycle_week_numbers') as string | null
  if (cycleWeeksRaw) {
    payload.cycle_week_numbers = JSON.parse(cycleWeeksRaw)
  }

  if (formData.get('notes') !== null) payload.notes = (formData.get('notes') as string) || null

  const { error } = await supabase
    .from('contract_visit_slots')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_visit_slot', entityId: id, action: 'updated', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function updateVisitSlotTimes(id: string, startTime: string, endTime: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_visit_slots')
    .update({
      override_start_time: startTime,
      override_end_time: endTime,
      time_slot: 'custom',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_visit_slot', entityId: id, action: 'times_adjusted', details: { startTime, endTime } })
  return {}
}

export async function deleteVisitSlot(id: string, contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_visit_slots')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract_visit_slot', entityId: id, action: 'deleted', details: { contract_id: contractId } })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function checkEngineerConflict(
  engineerId: string,
  dayOfWeek: string,
  cycleWeekNumbers: number[],
  excludeSlotId?: string
): Promise<{ hasConflict: boolean; conflictDetails?: string }> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('contract_visit_slots')
    .select('id, day_of_week, cycle_week_numbers, time_slot, customer_contract_id, customer_contracts!inner(status, contract_number, customers(name))')
    .eq('engineer_id', engineerId)
    .eq('day_of_week', dayOfWeek)

  if (excludeSlotId) {
    query = query.neq('id', excludeSlotId)
  }

  const { data } = await query

  if (!data || data.length === 0) return { hasConflict: false }

  // Check for overlapping cycle weeks on active contracts
  for (const slot of data) {
    const cc = slot.customer_contracts as unknown as { status: string; contract_number: string; customers: { name: string } | null }
    if (cc.status !== 'active' && cc.status !== 'draft') continue

    const existingWeeks = slot.cycle_week_numbers as number[]
    const overlap = cycleWeekNumbers.filter((w) => existingWeeks.includes(w))
    if (overlap.length > 0) {
      const customerName = cc.customers?.name || 'Unknown'
      return {
        hasConflict: true,
        conflictDetails: `${customerName} (${cc.contract_number}) — ${slot.day_of_week}, Week${overlap.length > 1 ? 's' : ''} ${overlap.join(', ')}`,
      }
    }
  }

  return { hasConflict: false }
}

export async function getEngineerSlots(engineerId: string): Promise<ContractVisitSlotWithDetails[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contract_visit_slots')
    .select(`
      *,
      users!contract_visit_slots_engineer_id_fkey(first_name, last_name, initials, color, avatar_url),
      customer_contracts!inner(
        contract_number, customer_id, status,
        customers(name),
        contract_types(name, code)
      )
    `)
    .eq('engineer_id', engineerId)
    .order('sort_order')

  if (error) {
    console.error('[contracts] getEngineerSlots:', error.message)
    return []
  }

  return (data || [])
    .filter((s: Record<string, unknown>) => {
      const cc = s.customer_contracts as Record<string, unknown>
      return cc.status === 'active' || cc.status === 'draft'
    })
    .map((s: Record<string, unknown>) => {
      const eng = s.users as Record<string, string> | null
      const cc = s.customer_contracts as Record<string, unknown>
      const customer = cc.customers as Record<string, string> | null
      const ct = cc.contract_types as Record<string, string> | null
      return {
        ...s,
        contract_number: cc.contract_number as string,
        customer_id: cc.customer_id as string,
        customer_name: customer?.name || 'Unknown',
        contract_type_name: ct?.name || 'Unknown',
        contract_type_code: ct?.code || '',
        engineer_name: eng ? `${eng.first_name} ${eng.last_name}` : 'Unknown',
        effective_start_time: (s.override_start_time as string) || (s.default_start_time as string),
        effective_end_time: (s.override_end_time as string) || (s.default_end_time as string),
      }
    }) as ContractVisitSlotWithDetails[]
}

export async function getFieldEngineers(): Promise<FieldEngineer[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  // Include users with field_engineer OR engineering role (backward compatibility)
  const { data: roleUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color, avatar_url, roles!inner(name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .in('roles.name', ['field_engineer', 'engineering'])
    .order('first_name')

  // Also check team membership (infrastructure/engineering teams)
  const { data: teamUsers } = await supabase
    .from('team_members')
    .select('users(id, first_name, last_name, initials, color, avatar_url), teams!inner(slug)')
    .in('teams.slug', ['infrastructure', 'engineering'])

  // Merge and deduplicate
  const userMap = new Map<string, FieldEngineer>()
  for (const u of roleUsers || []) {
    userMap.set(u.id, { id: u.id, first_name: u.first_name, last_name: u.last_name, initials: u.initials, color: u.color, avatar_url: u.avatar_url })
  }
  for (const tm of teamUsers || []) {
    const u = tm.users as unknown as FieldEngineer
    if (u && !userMap.has(u.id)) {
      userMap.set(u.id, { id: u.id, first_name: u.first_name, last_name: u.last_name, initials: u.initials, color: u.color, avatar_url: u.avatar_url })
    }
  }

  return Array.from(userMap.values()).sort((a, b) => a.first_name.localeCompare(b.first_name))
}

// ============================================================
// Seed Data
// ============================================================

export async function seedContractTypes(): Promise<{ error?: string; message?: string }> {
  const user = await requirePermission('contracts', 'edit')
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return { error: 'Admin access required' }
  }
  const supabase = await createClient()

  const types = [
    { name: 'ProFlex 1', code: 'proflex_1', description: 'Monthly ICT support visits with telephone and remote support', category: 'ict', default_visit_frequency: 'monthly', default_visit_length_hours: 4.0, default_visits_per_year: 12, includes_remote_support: true, includes_telephone: true, includes_onsite: true, allowed_schedule_weeks: [36], sort_order: 1 },
    { name: 'ProFlex 2', code: 'proflex_2', description: 'Fortnightly ICT support visits with telephone and remote support', category: 'ict', default_visit_frequency: 'fortnightly', default_visit_length_hours: 4.0, default_visits_per_year: 26, includes_remote_support: true, includes_telephone: true, includes_onsite: true, allowed_schedule_weeks: [36], sort_order: 2 },
    { name: 'ProFlex 3', code: 'proflex_3', description: 'Weekly ICT support visits with telephone and remote support', category: 'ict', default_visit_frequency: 'weekly', default_visit_length_hours: 4.0, default_visits_per_year: 39, includes_remote_support: true, includes_telephone: true, includes_onsite: true, allowed_schedule_weeks: [36], sort_order: 3 },
    { name: 'ProFlex 4', code: 'proflex_4', description: 'Bespoke ICT support — up to daily visits, fully customisable', category: 'ict', default_visit_frequency: 'daily', default_visit_length_hours: null, default_visits_per_year: null, includes_remote_support: true, includes_telephone: true, includes_onsite: true, allowed_schedule_weeks: [36, 39], sort_order: 4 },
  ]

  let created = 0
  for (const t of types) {
    const { error } = await supabase
      .from('contract_types')
      .upsert({ ...t, org_id: user.orgId }, { onConflict: 'org_id,code' })

    if (!error) created++
  }

  revalidatePath('/settings/contract-types')
  return { message: `Seeded ${created} contract types` }
}

// ============================================================
// Helper — List data for forms
// ============================================================

export async function getContractFormData(): Promise<{
  customers: { id: string; name: string }[]
  contractTypes: ContractType[]
  opportunities: { id: string; title: string; customer_id: string }[]
  calendars: { id: string; name: string; schedule_weeks: number; status: string }[]
  slaPlans: { id: string; name: string }[]
}> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const [customersRes, typesRes, oppsRes, calendarsRes, slaRes] = await Promise.all([
    supabase.from('customers').select('id, name').eq('org_id', user.orgId).eq('is_active', true).order('name'),
    supabase.from('contract_types').select('*').eq('org_id', user.orgId).eq('is_active', true).order('sort_order'),
    supabase.from('opportunities').select('id, title, customer_id').eq('org_id', user.orgId).not('stage', 'eq', 'lost').order('title'),
    supabase.from('visit_calendars').select('id, name, schedule_weeks, status').eq('org_id', user.orgId).eq('status', 'active').order('name'),
    supabase.from('sla_plans').select('id, name').eq('org_id', user.orgId).eq('is_active', true).order('name'),
  ])

  return {
    customers: customersRes.data || [],
    contractTypes: typesRes.data || [],
    opportunities: oppsRes.data || [],
    calendars: calendarsRes.data || [],
    slaPlans: slaRes.data || [],
  }
}

export async function getContactsByCustomer(customerId: string): Promise<{ id: string; first_name: string; last_name: string }[]> {
  await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('first_name')

  return data || []
}

export async function getSlaPlanOptions(): Promise<{ id: string; name: string }[]> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('sla_plans')
    .select('id, name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  return data || []
}

// ============================================================
// Private helpers
// ============================================================

function mapContractRow(row: Record<string, unknown>): CustomerContractWithDetails {
  const customers = row.customers as Record<string, string> | null
  const ct = row.contract_types as Record<string, unknown> | null
  const contact = row.contacts as Record<string, string> | null
  const cal = row.visit_calendars as Record<string, unknown> | null
  const sla = row.sla_plans as Record<string, string> | null

  // SLA: contract-level overrides type default
  const effectiveSlaPlanId = (row.sla_plan_id as string) || (ct?.default_sla_plan_id as string) || null
  const effectiveSlaPlanName = (row.sla_plan_id && sla) ? sla.name : null

  return {
    ...(row as unknown as CustomerContract),
    customer_name: customers?.name || 'Unknown',
    contract_type_name: (ct?.name as string) || 'Unknown',
    contract_type_code: (ct?.code as string) || '',
    category: (ct?.category as string) || 'ict',
    effective_frequency: (row.visit_frequency as string) || (ct?.default_visit_frequency as string) || null,
    effective_visits_per_year: (row.visits_per_year as number) ?? (ct?.default_visits_per_year as number) ?? null,
    effective_visit_hours: (row.visit_length_hours as number) ?? (ct?.default_visit_length_hours as number) ?? null,
    includes_remote_support: (ct?.includes_remote_support as boolean) || false,
    includes_telephone: (ct?.includes_telephone as boolean) || false,
    includes_onsite: (ct?.includes_onsite as boolean) || false,
    effective_sla_plan_id: effectiveSlaPlanId,
    effective_sla_plan_name: effectiveSlaPlanName,
    effective_monthly_hours: (row.monthly_hours as number) ?? (ct?.default_monthly_hours as number) ?? null,
    contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
    calendar_name: (cal?.name as string) || null,
    calendar_schedule_weeks: (cal?.schedule_weeks as number) || null,
  }
}

// ============================================================
// E-Sign Actions (Phase 3)
// ============================================================

export async function signContract(contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: contract, error: fetchError } = await supabase
    .from('customer_contracts')
    .select('id, esign_status, status, contract_number')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) return { error: fetchError?.message || 'Contract not found' }
  if (contract.esign_status !== 'pending') return { error: 'Contract is not pending e-signature' }

  const { error: updateError } = await supabase
    .from('customer_contracts')
    .update({
      esign_status: 'signed',
      status: contract.status === 'draft' ? 'active' : contract.status,
      last_signed_at: new Date().toISOString(),
      signed_by_name: `${user.firstName} ${user.lastName}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (updateError) return { error: updateError.message }

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'signed',
    details: { contract_number: contract.contract_number },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')
  // Also revalidate any linked quote for the SO gate
  const { data: cc } = await supabase.from('customer_contracts').select('source_quote_id').eq('id', contractId).single()
  if (cc?.source_quote_id) revalidatePath(`/quotes/${cc.source_quote_id}`)

  return {}
}

export async function waiveEsign(contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return { error: 'Only admins can waive e-sign requirements' }
  }
  const supabase = await createClient()

  const { data: contract, error: fetchError } = await supabase
    .from('customer_contracts')
    .select('id, esign_status, status, contract_number')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) return { error: fetchError?.message || 'Contract not found' }
  if (contract.esign_status !== 'pending') return { error: 'Contract is not pending e-signature' }

  const { error: updateError } = await supabase
    .from('customer_contracts')
    .update({
      esign_status: 'waived',
      status: contract.status === 'draft' ? 'active' : contract.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (updateError) return { error: updateError.message }

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'esign_waived',
    details: { contract_number: contract.contract_number },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')
  const { data: cc } = await supabase.from('customer_contracts').select('source_quote_id').eq('id', contractId).single()
  if (cc?.source_quote_id) revalidatePath(`/quotes/${cc.source_quote_id}`)

  return {}
}

// ============================================================
// Contract Creation from Quote Lines (Phase 2)
// ============================================================

export async function createContractFromLines(payload: {
  quote_id: string
  customer_id: string
  contract_type_id: string
  selected_line_ids: string[]
  go_live_date: string
  term_months: number | null
  notice_alert_days: number
  secondary_alert_days: number
  auto_invoice: boolean
  invoice_frequency: string
  annual_value: number
}): Promise<{ success: boolean; contractId?: string; contractNumber?: string; error?: string }> {
  const user = await requirePermission('contracts', 'create')
  const supabase = await createClient()

  // Fetch selected quote lines
  const { data: quoteLines, error: linesError } = await supabase
    .from('quote_lines')
    .select('id, description, product_id, quantity, buy_price, sell_price, products(product_type)')
    .in('id', payload.selected_line_ids)

  if (linesError || !quoteLines?.length) {
    return { success: false, error: linesError?.message || 'No matching quote lines found' }
  }

  // Fetch contract type for category
  const { data: contractType } = await supabase
    .from('contract_types')
    .select('category')
    .eq('id', payload.contract_type_id)
    .single()

  const category = (contractType?.category as string) || 'support'

  // Generate contract number
  const contractNumber = await generateContractNumber(supabase, user.orgId)

  // Calculate dates
  const goLive = new Date(payload.go_live_date)
  let endDate: string | null = null
  let invoiceScheduleStart: string | null = null

  if (payload.term_months) {
    const end = new Date(goLive)
    end.setMonth(end.getMonth() + payload.term_months)
    end.setDate(end.getDate() - 1)
    endDate = end.toISOString().split('T')[0]

    // Invoice schedule starts 12 months after go-live (year 1 covered by SO)
    const schedStart = new Date(goLive)
    schedStart.setFullYear(schedStart.getFullYear() + 1)
    invoiceScheduleStart = schedStart.toISOString().split('T')[0]
  } else if (payload.auto_invoice) {
    // Open-ended with auto invoice: schedule starts 12 months after go-live
    const schedStart = new Date(goLive)
    schedStart.setFullYear(schedStart.getFullYear() + 1)
    invoiceScheduleStart = schedStart.toISOString().split('T')[0]
  }

  // Determine e-sign status
  const esignStatus = ['service', 'licensing'].includes(category) ? 'pending' : 'not_required'

  // Insert contract
  const { data: contract, error: contractError } = await supabase
    .from('customer_contracts')
    .insert({
      org_id: user.orgId,
      customer_id: payload.customer_id,
      contract_type_id: payload.contract_type_id,
      contract_number: contractNumber,
      status: 'draft',
      start_date: payload.go_live_date,
      end_date: endDate,
      renewal_period: 'custom',
      annual_value: payload.annual_value,
      billing_frequency: 'annually',
      source_quote_id: payload.quote_id,
      term_months: payload.term_months,
      go_live_date: payload.go_live_date,
      invoice_schedule_start: invoiceScheduleStart,
      notice_alert_days: payload.notice_alert_days,
      secondary_alert_days: payload.secondary_alert_days,
      auto_invoice: payload.auto_invoice,
      invoice_frequency: payload.invoice_frequency,
      renewal_status: 'active',
      esign_status: esignStatus,
      created_by: user.id,
    })
    .select('id, contract_number')
    .single()

  if (contractError || !contract) {
    return { success: false, error: contractError?.message || 'Failed to create contract' }
  }

  // Insert contract lines
  const contractLines = quoteLines.map((ql, idx) => {
    const prods = ql.products as unknown as { product_type: string } | { product_type: string }[] | null
    const prodObj = Array.isArray(prods) ? prods[0] : prods
    const productType = prodObj?.product_type || null
    return {
      customer_contract_id: contract.id,
      description: ql.description,
      quantity: ql.quantity,
      unit_price_annual: ql.sell_price,
      unit_price: ql.sell_price,
      buy_price: ql.buy_price,
      product_id: ql.product_id,
      product_type: productType,
      source_quote_line_id: ql.id,
      line_type: 'recurring' as const,
      sort_order: idx,
    }
  })

  const { data: insertedLines, error: lineInsertError } = await supabase
    .from('contract_lines')
    .insert(contractLines)
    .select('id, product_id')

  if (lineInsertError) {
    console.error('[contracts] Failed to insert contract lines:', lineInsertError.message)
  }

  // Insert supplier price stubs
  if (insertedLines?.length) {
    const stubRows = insertedLines.map(line => ({
      org_id: user.orgId,
      contract_line_id: line.id,
      product_id: line.product_id,
      notes: 'Stub — awaiting supplier price list integration',
    }))

    await supabase.from('contract_line_supplier_prices').insert(stubRows)
  }

  // Fetch quote number for activity log
  const { data: quote } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('id', payload.quote_id)
    .single()

  // Log activity on contract
  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contract.id,
    action: 'created',
    details: { source: 'quote', quote_number: quote?.quote_number, lines: payload.selected_line_ids.length },
  })

  // Log activity on quote
  logActivity({
    supabase, user,
    entityType: 'quote',
    entityId: payload.quote_id,
    action: 'contract_created',
    details: { contract_number: contract.contract_number },
  })

  revalidatePath('/contracts')
  revalidatePath(`/quotes/${payload.quote_id}`)

  return { success: true, contractId: contract.id, contractNumber: contract.contract_number }
}

// Fetch contracts linked to a quote via source_quote_id
export async function getContractsBySourceQuote(quoteId: string): Promise<{
  id: string
  contract_number: string
  category: string
  esign_status: string
  status: string
}[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_contracts')
    .select('id, contract_number, esign_status, status, contract_types(category)')
    .eq('source_quote_id', quoteId)

  if (error || !data) return []

  return data.map(c => ({
    id: c.id,
    contract_number: c.contract_number,
    category: (() => { const ct = c.contract_types as unknown as { category: string } | { category: string }[] | null; const obj = Array.isArray(ct) ? ct[0] : ct; return obj?.category || 'support' })(),
    esign_status: c.esign_status || 'not_required',
    status: c.status,
  }))
}
