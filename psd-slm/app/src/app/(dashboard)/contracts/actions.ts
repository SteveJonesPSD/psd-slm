'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { generateInvoiceNumber } from '@/lib/invoicing'
import type {
  ContractType,
  CustomerContract,
  CustomerContractWithDetails,
  ContractLine,
  ContractEntitlement,
  ContractRenewal,
  ContractVisitSlot,
  ContractVisitSlotWithDetails,
  ContractInvoiceSchedule,
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

export async function syncContractAlertStatuses(): Promise<void> {
  const user = await requireAuth()
  if (!hasPermission(user, 'contracts', 'view')) return
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  // Fetch active contracts with end dates to check thresholds
  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('id, end_date, renewal_status, notice_alert_days, secondary_alert_days, contract_types(default_notice_alert_days, secondary_alert_days)')
    .eq('org_id', user.orgId)
    .not('end_date', 'is', null)
    .in('status', ['active'])
    .in('renewal_status', ['active', 'alert_180'])

  if (!contracts || contracts.length === 0) return

  for (const c of contracts) {
    const ct = (Array.isArray(c.contract_types) ? c.contract_types[0] : c.contract_types) as Record<string, unknown> | null
    const noticeAlertDays = c.notice_alert_days ?? (ct?.default_notice_alert_days as number) ?? 180
    const secondaryAlertDays = c.secondary_alert_days ?? (ct?.secondary_alert_days as number) ?? 90

    const endDate = new Date(c.end_date!)
    const todayDate = new Date(today)
    const daysRemaining = Math.floor((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

    let newStatus: string | null = null
    if (daysRemaining <= secondaryAlertDays && c.renewal_status !== 'alert_90') {
      newStatus = 'alert_90'
    } else if (daysRemaining <= noticeAlertDays && daysRemaining > secondaryAlertDays && c.renewal_status === 'active') {
      newStatus = 'alert_180'
    }

    if (newStatus) {
      await supabase
        .from('customer_contracts')
        .update({ renewal_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', c.id)
    }
  }
}

export interface ContractAlerts {
  expiring90: number
  expiring180: number
  pendingInvoices: number
  esignPending: number
}

export async function getContractAlerts(): Promise<ContractAlerts> {
  const user = await requireAuth()
  if (!hasPermission(user, 'contracts', 'view')) return { expiring90: 0, expiring180: 0, pendingInvoices: 0, esignPending: 0 }
  const supabase = await createClient()

  const today = new Date()
  const in90 = new Date(); in90.setDate(in90.getDate() + 90)
  const in180 = new Date(); in180.setDate(in180.getDate() + 180)

  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('status, end_date, esign_status, renewal_status')
    .eq('org_id', user.orgId)

  const all = contracts || []
  const active = all.filter(c => c.status === 'active')

  const expiring90 = active.filter(c => c.end_date && new Date(c.end_date) <= in90 && new Date(c.end_date) > today).length
  const expiring180 = active.filter(c => c.end_date && new Date(c.end_date) <= in180 && new Date(c.end_date) > in90).length
  const esignPending = all.filter(c => c.esign_status === 'pending').length

  // Pending invoice schedules
  const { count: pendingInvoices } = await supabase
    .from('contract_invoice_schedule')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .eq('status', 'pending')
    .lte('scheduled_date', today.toISOString().split('T')[0])
    .is('invoice_id', null)

  return {
    expiring90,
    expiring180,
    pendingInvoices: pendingInvoices || 0,
    esignPending,
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

  // Generate invoice schedule on activation
  await generateInvoiceSchedule(contractId).catch(() => {})

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

  // Generate invoice schedule on activation
  await generateInvoiceSchedule(contractId).catch(() => {})

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
// Invoice Schedule Engine (Phase 4)
// ============================================================

export async function generateInvoiceSchedule(contractId: string): Promise<{ count: number; error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: contract, error: fetchErr } = await supabase
    .from('customer_contracts')
    .select('*, contract_types(*)')
    .eq('id', contractId)
    .single()

  if (fetchErr || !contract) return { count: 0, error: fetchErr?.message || 'Contract not found' }

  const ct = (Array.isArray(contract.contract_types) ? contract.contract_types[0] : contract.contract_types) as Record<string, unknown> | null

  const effectiveAutoInvoice = contract.auto_invoice ?? (ct?.auto_invoice as boolean) ?? false
  const effectiveFrequency = contract.invoice_frequency ?? (ct?.invoice_frequency as string) ?? 'annual'

  // If auto_invoice off, or open-ended without auto_invoice, do nothing
  if (!effectiveAutoInvoice) return { count: 0 }

  const goLive = contract.go_live_date ? new Date(contract.go_live_date) : new Date(contract.start_date)
  const scheduleStart = contract.invoice_schedule_start
    ? new Date(contract.invoice_schedule_start)
    : new Date(goLive.getTime())

  // For annual: schedule starts at go_live + 12 months (Year 2 onwards)
  if (effectiveFrequency === 'annual' && !contract.invoice_schedule_start) {
    scheduleStart.setMonth(scheduleStart.getMonth() + 12)
  }

  // Determine end boundary
  let endBoundary: Date
  if (contract.end_date) {
    endBoundary = new Date(contract.end_date)
  } else {
    // Open-ended: generate 3 years forward from go-live
    endBoundary = new Date(goLive.getTime())
    endBoundary.setFullYear(endBoundary.getFullYear() + 4)
  }

  const baseAmount = Number(contract.annual_value) || 0
  const rows: Array<{
    org_id: string
    contract_id: string
    scheduled_date: string
    period_label: string
    period_start: string
    period_end: string
    base_amount: number
    status: string
  }> = []

  const fmtDate = (d: Date) => d.toISOString().split('T')[0]
  const fmtLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  if (effectiveFrequency === 'annual') {
    let yearNum = 2
    const periodStart = new Date(goLive.getTime())
    periodStart.setMonth(periodStart.getMonth() + 12)

    while (periodStart < endBoundary) {
      const periodEnd = new Date(periodStart.getTime())
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      periodEnd.setDate(periodEnd.getDate() - 1)

      const scheduledDate = new Date(periodStart.getTime())

      rows.push({
        org_id: user.orgId,
        contract_id: contractId,
        scheduled_date: fmtDate(scheduledDate),
        period_label: `Year ${yearNum} (${fmtLabel(periodStart)} – ${fmtLabel(periodEnd)})`,
        period_start: fmtDate(periodStart),
        period_end: fmtDate(periodEnd),
        base_amount: baseAmount,
        status: 'pending',
      })

      periodStart.setFullYear(periodStart.getFullYear() + 1)
      yearNum++
    }
  } else if (effectiveFrequency === 'monthly') {
    const monthlyAmount = baseAmount / 12
    let monthNum = 2
    const periodStart = new Date(goLive.getTime())
    periodStart.setMonth(periodStart.getMonth() + 1)

    while (periodStart < endBoundary) {
      const periodEnd = new Date(periodStart.getTime())
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      periodEnd.setDate(periodEnd.getDate() - 1)

      const monthLabel = periodStart.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

      rows.push({
        org_id: user.orgId,
        contract_id: contractId,
        scheduled_date: fmtDate(periodStart),
        period_label: `Month ${monthNum} — ${monthLabel}`,
        period_start: fmtDate(periodStart),
        period_end: fmtDate(periodEnd),
        base_amount: monthlyAmount,
        status: 'pending',
      })

      periodStart.setMonth(periodStart.getMonth() + 1)
      monthNum++
    }
  } else if (effectiveFrequency === 'quarterly') {
    const quarterlyAmount = baseAmount / 4
    let qNum = 1
    const periodStart = new Date(goLive.getTime())
    periodStart.setMonth(periodStart.getMonth() + 12) // Year 2 onwards

    while (periodStart < endBoundary) {
      const periodEnd = new Date(periodStart.getTime())
      periodEnd.setMonth(periodEnd.getMonth() + 3)
      periodEnd.setDate(periodEnd.getDate() - 1)

      rows.push({
        org_id: user.orgId,
        contract_id: contractId,
        scheduled_date: fmtDate(periodStart),
        period_label: `Q${qNum} (${fmtLabel(periodStart)} – ${fmtLabel(periodEnd)})`,
        period_start: fmtDate(periodStart),
        period_end: fmtDate(periodEnd),
        base_amount: quarterlyAmount,
        status: 'pending',
      })

      periodStart.setMonth(periodStart.getMonth() + 3)
      qNum++
    }
  }

  if (rows.length === 0) return { count: 0 }

  // Delete any existing pending rows to regenerate cleanly
  await supabase
    .from('contract_invoice_schedule')
    .delete()
    .eq('contract_id', contractId)
    .eq('status', 'pending')

  const { error: insertErr } = await supabase
    .from('contract_invoice_schedule')
    .insert(rows)

  if (insertErr) return { count: 0, error: insertErr.message }

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'invoice_schedule_generated',
    details: { periods: rows.length },
  })

  return { count: rows.length }
}

export async function getInvoiceSchedule(contractId: string): Promise<ContractInvoiceSchedule[]> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contract_invoice_schedule')
    .select('*, invoices(invoice_number)')
    .eq('contract_id', contractId)
    .order('scheduled_date')

  if (error || !data) return []

  return data.map(row => ({
    ...row,
    invoice_number: (row.invoices as { invoice_number: string } | null)?.invoice_number || null,
    effective_amount: row.amount_override ?? row.base_amount,
  })) as ContractInvoiceSchedule[]
}

export async function processPendingContractInvoices(
  contractId?: string
): Promise<{ processed: number; errors: string[] }> {
  const user = await requirePermission('invoices', 'create')
  const supabase = await createClient()

  let query = supabase
    .from('contract_invoice_schedule')
    .select('*, customer_contracts(*, contract_types(*))')
    .eq('org_id', user.orgId)
    .eq('status', 'pending')
    .lte('scheduled_date', new Date().toISOString().split('T')[0])
    .is('invoice_id', null)

  if (contractId) query = query.eq('contract_id', contractId)

  const { data: pendingRows, error } = await query
  if (error || !pendingRows || pendingRows.length === 0) return { processed: 0, errors: [] }

  let processed = 0
  const errors: string[] = []

  for (const row of pendingRows) {
    try {
      const cc = (Array.isArray(row.customer_contracts) ? row.customer_contracts[0] : row.customer_contracts) as Record<string, unknown> | null
      if (!cc) { errors.push(`Row ${row.id}: no contract found`); continue }

      const customerId = cc.customer_id as string

      // Fetch contract lines for recurring items
      const { data: contractLines } = await supabase
        .from('contract_lines')
        .select('*')
        .eq('customer_contract_id', row.contract_id)
        .eq('line_type', 'recurring')
        .order('sort_order')

      const effectiveAmount = row.amount_override ?? row.base_amount
      const invoiceNumber = await generateInvoiceNumber(supabase, user.orgId, 'INV')

      const subtotal = contractLines && contractLines.length > 0
        ? contractLines.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.quantity) || 1) * (Number(l.unit_price) || 0), 0)
        : Number(effectiveAmount)

      const vatRate = 20
      const vatAmount = subtotal * (vatRate / 100)
      const total = subtotal + vatAmount

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          org_id: user.orgId,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          status: 'draft',
          invoice_type: 'standard',
          subtotal,
          vat_amount: vatAmount,
          total,
          vat_rate: vatRate,
          due_date: dueDate.toISOString().split('T')[0],
          internal_notes: `Auto-generated from contract ${cc.contract_number} — ${row.period_label}`,
          payment_terms: 30,
        })
        .select('id')
        .single()

      if (invErr || !invoice) {
        errors.push(`Row ${row.id}: ${invErr?.message || 'Failed to create invoice'}`)
        continue
      }

      // Insert invoice lines
      if (contractLines && contractLines.length > 0) {
        const lineInserts = contractLines.map((cl: Record<string, unknown>, idx: number) => ({
          invoice_id: invoice.id,
          description: `${cl.description} — ${row.period_label}`,
          quantity: Number(cl.quantity) || 1,
          unit_price: Number(cl.unit_price) || 0,
          unit_cost: Number(cl.buy_price) || 0,
          vat_rate: vatRate,
          sort_order: idx + 1,
          product_id: cl.product_id || null,
        }))
        await supabase.from('invoice_lines').insert(lineInserts)
      } else {
        await supabase.from('invoice_lines').insert({
          invoice_id: invoice.id,
          description: `Contract Renewal — ${row.period_label}`,
          quantity: 1,
          unit_price: Number(effectiveAmount),
          unit_cost: 0,
          vat_rate: vatRate,
          sort_order: 1,
        })
      }

      // Update schedule row
      await supabase
        .from('contract_invoice_schedule')
        .update({ invoice_id: invoice.id, status: 'draft_created', updated_at: new Date().toISOString() })
        .eq('id', row.id)

      logActivity({
        supabase, user,
        entityType: 'contract',
        entityId: row.contract_id,
        action: 'contract_invoice_created',
        details: { period_label: row.period_label, invoice_number: invoiceNumber },
      })

      processed++
    } catch (e) {
      errors.push(`Row ${row.id}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  if (processed > 0 && contractId) {
    revalidatePath(`/contracts/${contractId}`)
  }

  return { processed, errors }
}

export async function updateScheduleAmountOverride(
  scheduleId: string,
  amountOverride: number | null
): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('contract_invoice_schedule')
    .select('id, contract_id, status, period_label')
    .eq('id', scheduleId)
    .single()

  if (!row) return { error: 'Schedule row not found' }
  if (row.status !== 'pending') return { error: 'Can only override pending schedule rows' }

  const { error } = await supabase
    .from('contract_invoice_schedule')
    .update({ amount_override: amountOverride, updated_at: new Date().toISOString() })
    .eq('id', scheduleId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: row.contract_id,
    action: 'schedule_amount_override',
    details: { period_label: row.period_label, amount_override: amountOverride },
  })

  revalidatePath(`/contracts/${row.contract_id}`)
  return {}
}

export async function skipScheduleRow(
  scheduleId: string,
  notes: string
): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('contract_invoice_schedule')
    .select('id, contract_id, status, period_label')
    .eq('id', scheduleId)
    .single()

  if (!row) return { error: 'Schedule row not found' }
  if (row.status !== 'pending') return { error: 'Can only skip pending schedule rows' }

  const { error } = await supabase
    .from('contract_invoice_schedule')
    .update({ status: 'skipped', notes, updated_at: new Date().toISOString() })
    .eq('id', scheduleId)

  if (error) return { error: error.message }

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: row.contract_id,
    action: 'schedule_row_skipped',
    details: { period_label: row.period_label, notes },
  })

  revalidatePath(`/contracts/${row.contract_id}`)
  return {}
}

// ============================================================
// Upgrade & Credit Note Flow (Phase 6)
// ============================================================

export async function getUpgradeCalculation(contractId: string, goLiveDate: string): Promise<{
  invoiceId?: string
  invoiceNumber?: string
  periodStart?: string
  periodEnd?: string
  invoiceAmount?: number
  daysRemaining?: number
  daysInPeriod?: number
  creditAmount?: number
  error?: string
}> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  // Find the most recent sent/paid invoice from the schedule
  const { data: scheduleRows } = await supabase
    .from('contract_invoice_schedule')
    .select('*, invoices(id, invoice_number, status, total)')
    .eq('contract_id', contractId)
    .in('status', ['draft_created', 'sent'])
    .not('invoice_id', 'is', null)
    .order('period_end', { ascending: false })
    .limit(1)

  if (!scheduleRows || scheduleRows.length === 0) {
    return { error: 'No invoice found for credit calculation. Has Year 1 been invoiced via Sales Order?' }
  }

  const row = scheduleRows[0]
  const inv = (Array.isArray(row.invoices) ? row.invoices[0] : row.invoices) as { id: string; invoice_number: string; total: number } | null
  if (!inv) return { error: 'Invoice data not found' }

  const periodStart = new Date(row.period_start)
  const periodEnd = new Date(row.period_end)
  const goLive = new Date(goLiveDate)

  const daysRemaining = Math.max(0, Math.floor((periodEnd.getTime() - goLive.getTime()) / (1000 * 60 * 60 * 24)))
  const daysInPeriod = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const effectiveAmount = row.amount_override ?? row.base_amount
  const creditAmount = Math.round((daysRemaining / daysInPeriod) * Number(effectiveAmount) * 100) / 100

  return {
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    invoiceAmount: Number(effectiveAmount),
    daysRemaining,
    daysInPeriod,
    creditAmount,
  }
}

export async function upgradeContract(
  contractId: string,
  upgradeGoLiveDate: string
): Promise<{ success: boolean; creditNoteId?: string; creditNoteNumber?: string; creditAmount?: number; error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  // Fetch contract
  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('*, contract_types(category)')
    .eq('id', contractId)
    .single()

  if (!contract) return { success: false, error: 'Contract not found' }

  const ct = (Array.isArray(contract.contract_types) ? contract.contract_types[0] : contract.contract_types) as Record<string, unknown> | null
  if ((ct?.category as string) !== 'service') return { success: false, error: 'Upgrades only apply to service contracts' }

  // Calculate credit
  const calc = await getUpgradeCalculation(contractId, upgradeGoLiveDate)
  if (calc.error) return { success: false, error: calc.error }

  // Create credit note
  const creditNoteNumber = await generateInvoiceNumber(supabase, user.orgId, 'CN')

  const creditAmount = calc.creditAmount || 0
  const vatRate = 20
  const subtotal = -creditAmount
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + vatAmount

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: creditNote, error: cnErr } = await supabase
    .from('invoices')
    .insert({
      org_id: user.orgId,
      customer_id: contract.customer_id,
      invoice_number: creditNoteNumber,
      status: 'draft',
      invoice_type: 'credit_note',
      parent_invoice_id: calc.invoiceId,
      subtotal,
      vat_amount: vatAmount,
      total,
      vat_rate: vatRate,
      due_date: dueDate.toISOString().split('T')[0],
      internal_notes: `Pro-rata credit: ${calc.daysRemaining} days remaining of ${calc.daysInPeriod} day period. Auto-calculated on contract upgrade.`,
      payment_terms: 30,
    })
    .select('id')
    .single()

  if (cnErr || !creditNote) return { success: false, error: cnErr?.message || 'Failed to create credit note' }

  // Insert credit note line
  const goLiveFormatted = new Date(upgradeGoLiveDate).toLocaleDateString('en-GB')
  await supabase.from('invoice_lines').insert({
    invoice_id: creditNote.id,
    description: `Service Credit — ${contract.contract_number} — Go-live ${goLiveFormatted}`,
    quantity: 1,
    unit_price: -creditAmount,
    unit_cost: 0,
    vat_rate: vatRate,
    sort_order: 1,
  })

  // Cancel remaining pending schedule rows
  await supabase
    .from('contract_invoice_schedule')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('contract_id', contractId)
    .eq('status', 'pending')

  // Supersede the contract
  await supabase
    .from('customer_contracts')
    .update({
      renewal_status: 'superseded',
      upgrade_go_live_date: upgradeGoLiveDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract_upgraded',
    details: {
      contract_number: contract.contract_number,
      upgrade_go_live_date: upgradeGoLiveDate,
      credit_note_number: creditNoteNumber,
      credit_amount: creditAmount,
    },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')

  return { success: true, creditNoteId: creditNote.id, creditNoteNumber, creditAmount }
}

// ============================================================
// Licensing Renewal Flow (Phase 7)
// ============================================================

export async function getLicensingRenewalState(contractId: string): Promise<{
  renewalQuoteId?: string
  renewalQuoteNumber?: string
  workflowStatus?: string
  newContractId?: string
  newContractNumber?: string
} | null> {
  await requirePermission('contracts', 'view')
  const supabase = await createClient()

  const { data: renewal } = await supabase
    .from('contract_renewals')
    .select('*')
    .or(`old_contract_id.eq.${contractId},new_contract_id.eq.${contractId}`)
    .not('renewal_quote_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!renewal) return null

  // Fetch the quote separately to avoid FK naming issues
  let quoteNumber: string | undefined
  let quoteId: string | undefined
  if (renewal.renewal_quote_id) {
    const { data: q } = await supabase
      .from('quotes')
      .select('id, quote_number')
      .eq('id', renewal.renewal_quote_id)
      .single()
    if (q) { quoteId = q.id; quoteNumber = q.quote_number }
  }

  return {
    renewalQuoteId: quoteId,
    renewalQuoteNumber: quoteNumber,
    workflowStatus: renewal.renewal_workflow_status || 'pending',
    newContractId: renewal.new_contract_id,
    newContractNumber: undefined,
  }
}

export async function generateRenewalQuote(
  contractId: string
): Promise<{ success: boolean; quoteId?: string; quoteNumber?: string; error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('*, contract_types(category)')
    .eq('id', contractId)
    .single()

  if (!contract) return { success: false, error: 'Contract not found' }

  // Fetch contract lines
  const { data: contractLines } = await supabase
    .from('contract_lines')
    .select('*')
    .eq('customer_contract_id', contractId)
    .order('sort_order')

  // Fetch source quote for attribution and metadata
  let quoteType = 'business'
  let brandId: string | null = null
  let assignedTo: string | null = null
  let attributions: Array<{ user_id: string; attribution_type: string; percentage: number }> = []

  if (contract.source_quote_id) {
    const { data: srcQuote } = await supabase
      .from('quotes')
      .select('quote_type, brand_id, assigned_to')
      .eq('id', contract.source_quote_id)
      .single()
    if (srcQuote) {
      quoteType = srcQuote.quote_type || 'business'
      brandId = srcQuote.brand_id
      assignedTo = srcQuote.assigned_to
    }

    const { data: srcAttr } = await supabase
      .from('quote_attributions')
      .select('user_id, attribution_type, percentage')
      .eq('quote_id', contract.source_quote_id)
    if (srcAttr) attributions = srcAttr
  }

  // Generate quote number
  const year = new Date().getFullYear()
  const qPrefix = `Q-${year}-`
  const { data: lastQuote } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('org_id', user.orgId)
    .like('quote_number', `${qPrefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1)

  let nextSeq = 1
  if (lastQuote && lastQuote.length > 0) {
    const num = parseInt(lastQuote[0].quote_number.replace(qPrefix, ''), 10)
    if (!isNaN(num)) nextSeq = num + 1
  }
  const quoteNumber = `${qPrefix}${String(nextSeq).padStart(4, '0')}`

  // Create quote
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id: contract.customer_id,
      contact_id: contract.contact_id,
      quote_number: quoteNumber,
      status: 'draft',
      quote_type: quoteType,
      brand_id: brandId,
      assigned_to: assignedTo || user.id,
      internal_notes: `Renewal quote generated from contract ${contract.contract_number}`,
      version: 1,
    })
    .select('id, quote_number')
    .single()

  if (qErr || !quote) return { success: false, error: qErr?.message || 'Failed to create quote' }

  // Copy attributions
  if (attributions.length > 0) {
    await supabase.from('quote_attributions').insert(
      attributions.map(a => ({ quote_id: quote.id, ...a }))
    )
  } else {
    // Default attribution to assigned user
    await supabase.from('quote_attributions').insert({
      quote_id: quote.id,
      user_id: assignedTo || user.id,
      attribution_type: 'direct',
      percentage: 100,
    })
  }

  // Create default quote group
  const { data: group } = await supabase
    .from('quote_groups')
    .insert({ quote_id: quote.id, name: 'Renewal Items', sort_order: 0 })
    .select('id')
    .single()

  // Create quote lines from contract lines
  if (contractLines && contractLines.length > 0 && group) {
    const lineInserts = contractLines.map((cl: Record<string, unknown>, idx: number) => ({
      quote_id: quote.id,
      group_id: group.id,
      product_id: cl.product_id || null,
      description: cl.description,
      quantity: Number(cl.quantity) || 1,
      sell_price: Number(cl.unit_price) || 0,
      buy_price: Number(cl.buy_price) || 0,
      // TODO: When supplier price list module ships, refresh buy_price here
      // from contract_line_supplier_prices where contract_line_id matches
      // and use deal registration pricing if active deal reg exists
      vat_rate: 20,
      sort_order: idx,
      is_optional: false,
    }))
    await supabase.from('quote_lines').insert(lineInserts)
  }

  // Create contract_renewals row
  await supabase.from('contract_renewals').insert({
    old_contract_id: contractId,
    org_id: user.orgId,
    previous_end_date: contract.end_date || new Date().toISOString().split('T')[0],
    new_start_date: contract.end_date
      ? new Date(new Date(contract.end_date).getTime() + 86400000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    new_end_date: contract.end_date
      ? (() => { const d = new Date(contract.end_date); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0] })()
      : new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    renewal_quote_id: quote.id,
    renewal_workflow_status: 'quote_generated',
    renewed_by: user.id,
  })

  // Update contract renewal_status
  await supabase
    .from('customer_contracts')
    .update({ renewal_status: 'renewal_in_progress', updated_at: new Date().toISOString() })
    .eq('id', contractId)

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'renewal_quote_generated',
    details: { quote_number: quoteNumber },
  })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true, quoteId: quote.id, quoteNumber: quote.quote_number }
}

export async function markRenewalQuoteSent(contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_renewals')
    .update({ renewal_workflow_status: 'quote_sent' })
    .eq('old_contract_id', contractId)
    .not('renewal_quote_id', 'is', null)
    .eq('renewal_workflow_status', 'quote_generated')

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract', entityId: contractId, action: 'renewal_quote_sent', details: {} })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function markRenewalQuoteAccepted(contractId: string): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('contract_renewals')
    .update({ renewal_workflow_status: 'quote_accepted' })
    .eq('old_contract_id', contractId)
    .not('renewal_quote_id', 'is', null)
    .eq('renewal_workflow_status', 'quote_sent')

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'contract', entityId: contractId, action: 'renewal_quote_accepted', details: {} })
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function completeRenewalSigning(
  contractId: string,
  termMonths: number | null
): Promise<{ success: boolean; newContractId?: string; newContractNumber?: string; error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  // Fetch the renewal row
  const { data: renewal } = await supabase
    .from('contract_renewals')
    .select('*')
    .eq('old_contract_id', contractId)
    .not('renewal_quote_id', 'is', null)
    .eq('renewal_workflow_status', 'quote_accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!renewal) return { success: false, error: 'No accepted renewal found' }

  // Fetch old contract
  const { data: oldContract } = await supabase
    .from('customer_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!oldContract) return { success: false, error: 'Contract not found' }

  // Fetch renewal quote lines
  const { data: quoteLines } = await supabase
    .from('quote_lines')
    .select('*')
    .eq('quote_id', renewal.renewal_quote_id)
    .order('sort_order')

  // Create new contract
  const contractNumber = await generateContractNumber(supabase, user.orgId)
  const goLive = renewal.new_start_date
  const endDate = termMonths
    ? (() => { const d = new Date(goLive); d.setMonth(d.getMonth() + termMonths); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
    : null

  const annualValue = quoteLines
    ? quoteLines.reduce((sum: number, ql: Record<string, unknown>) => sum + (Number(ql.quantity) || 1) * (Number(ql.sell_price) || 0), 0)
    : oldContract.annual_value

  const { data: newContract, error: createErr } = await supabase
    .from('customer_contracts')
    .insert({
      org_id: user.orgId,
      customer_id: oldContract.customer_id,
      contract_type_id: oldContract.contract_type_id,
      contact_id: oldContract.contact_id,
      contract_number: contractNumber,
      status: 'active',
      parent_contract_id: contractId,
      version: (oldContract.version || 1) + 1,
      start_date: goLive,
      end_date: endDate,
      renewal_period: oldContract.renewal_period,
      auto_renew: oldContract.auto_renew,
      annual_value: annualValue,
      billing_frequency: oldContract.billing_frequency,
      source_quote_id: renewal.renewal_quote_id,
      term_months: termMonths,
      go_live_date: goLive,
      invoice_schedule_start: (() => { const d = new Date(goLive); d.setMonth(d.getMonth() + 12); return d.toISOString().split('T')[0] })(),
      esign_status: 'signed',
      renewal_status: 'active',
      auto_invoice: oldContract.auto_invoice,
      invoice_frequency: oldContract.invoice_frequency,
      calendar_id: oldContract.calendar_id,
      sla_plan_id: oldContract.sla_plan_id,
      monthly_hours: oldContract.monthly_hours,
      created_by: user.id,
    })
    .select('id, contract_number')
    .single()

  if (createErr || !newContract) return { success: false, error: createErr?.message || 'Failed to create contract' }

  // Copy lines from renewal quote
  if (quoteLines && quoteLines.length > 0) {
    const lineInserts = quoteLines.map((ql: Record<string, unknown>, idx: number) => ({
      customer_contract_id: newContract.id,
      description: ql.description as string,
      quantity: Number(ql.quantity) || 1,
      unit_price: Number(ql.sell_price) || 0,
      buy_price: Number(ql.buy_price) || 0,
      product_id: ql.product_id || null,
      product_type: null,
      line_type: 'recurring',
      sort_order: idx,
    }))
    await supabase.from('contract_lines').insert(lineInserts)
  }

  // Generate invoice schedule for new contract
  await generateInvoiceSchedule(newContract.id).catch(() => {})

  // Update old contract
  await supabase
    .from('customer_contracts')
    .update({ renewal_status: 'expired', status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', contractId)

  // Update renewal row
  await supabase
    .from('contract_renewals')
    .update({ renewal_workflow_status: 'completed', new_contract_id: newContract.id })
    .eq('id', renewal.id)

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract_renewed',
    details: { new_contract_number: newContract.contract_number },
  })
  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: newContract.id,
    action: 'contract_created_via_renewal',
    details: { old_contract_number: oldContract.contract_number },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath(`/contracts/${newContract.id}`)
  revalidatePath('/contracts')

  return { success: true, newContractId: newContract.id, newContractNumber: newContract.contract_number }
}

// ============================================================
// Rolling Contracts (Phase 8)
// ============================================================

export async function processExpiredFixedTermContracts(): Promise<void> {
  const user = await requireAuth()
  if (!hasPermission(user, 'contracts', 'view')) return
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select('id, end_date, is_rolling, renewal_status, auto_invoice, invoice_frequency, contract_types(category, auto_invoice, invoice_frequency)')
    .eq('org_id', user.orgId)
    .eq('status', 'active')
    .eq('is_rolling', false)
    .lt('end_date', today)
    .not('renewal_status', 'in', '("superseded","expired","cancelled","rolling","renewal_in_progress")')

  if (!contracts || contracts.length === 0) return

  for (const c of contracts) {
    const ct = (Array.isArray(c.contract_types) ? c.contract_types[0] : c.contract_types) as Record<string, unknown> | null
    const category = (ct?.category as string) || 'support'

    // Only service contracts auto-roll — licensing goes to renewal flow
    if (category !== 'service') {
      await supabase
        .from('customer_contracts')
        .update({ renewal_status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', c.id)
      continue
    }

    const effectiveAutoInvoice = c.auto_invoice ?? (ct?.auto_invoice as boolean) ?? false

    if (effectiveAutoInvoice) {
      const effectiveFrequency = c.invoice_frequency ?? (ct?.invoice_frequency as string) ?? 'annual'
      await supabase
        .from('customer_contracts')
        .update({
          is_rolling: true,
          renewal_status: 'rolling',
          rolling_frequency: effectiveFrequency === 'monthly' ? 'monthly' : 'annual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id)

      await extendRollingSchedule(c.id).catch(() => {})
    } else {
      await supabase
        .from('customer_contracts')
        .update({ renewal_status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', c.id)
    }
  }
}

export async function extendRollingSchedule(contractId: string): Promise<{ count: number; error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('customer_contracts')
    .select('*, contract_types(invoice_frequency)')
    .eq('id', contractId)
    .single()

  if (!contract) return { count: 0, error: 'Contract not found' }

  const ct = (Array.isArray(contract.contract_types) ? contract.contract_types[0] : contract.contract_types) as Record<string, unknown> | null
  const effectiveFrequency = contract.invoice_frequency ?? (ct?.invoice_frequency as string) ?? 'annual'

  // Find the last schedule row
  const { data: lastRow } = await supabase
    .from('contract_invoice_schedule')
    .select('period_end, base_amount')
    .eq('contract_id', contractId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const startFrom = lastRow
    ? new Date(new Date(lastRow.period_end).getTime() + 86400000) // day after last period end
    : new Date(contract.end_date || contract.start_date)

  const baseAmount = lastRow ? Number(lastRow.base_amount) : (Number(contract.annual_value) || 0)
  const fmtDate = (d: Date) => d.toISOString().split('T')[0]
  const fmtLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const rows: Array<{
    org_id: string; contract_id: string; scheduled_date: string
    period_label: string; period_start: string; period_end: string
    base_amount: number; status: string
  }> = []

  if (effectiveFrequency === 'annual') {
    const periodStart = new Date(startFrom)
    for (let i = 0; i < 3; i++) {
      const periodEnd = new Date(periodStart)
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      periodEnd.setDate(periodEnd.getDate() - 1)

      rows.push({
        org_id: user.orgId,
        contract_id: contractId,
        scheduled_date: fmtDate(periodStart),
        period_label: `Rolling Year (${fmtLabel(periodStart)} – ${fmtLabel(periodEnd)})`,
        period_start: fmtDate(periodStart),
        period_end: fmtDate(periodEnd),
        base_amount: baseAmount,
        status: 'pending',
      })

      periodStart.setFullYear(periodStart.getFullYear() + 1)
    }
  } else {
    const monthlyAmount = baseAmount / 12
    const periodStart = new Date(startFrom)
    for (let i = 0; i < 36; i++) {
      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      periodEnd.setDate(periodEnd.getDate() - 1)

      const monthLabel = periodStart.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      rows.push({
        org_id: user.orgId,
        contract_id: contractId,
        scheduled_date: fmtDate(periodStart),
        period_label: `Rolling — ${monthLabel}`,
        period_start: fmtDate(periodStart),
        period_end: fmtDate(periodEnd),
        base_amount: monthlyAmount,
        status: 'pending',
      })

      periodStart.setMonth(periodStart.getMonth() + 1)
    }
  }

  if (rows.length === 0) return { count: 0 }

  const { error } = await supabase.from('contract_invoice_schedule').insert(rows)
  if (error) return { count: 0, error: error.message }

  return { count: rows.length }
}

export async function cancelRollingContract(
  contractId: string,
  cancelDate: string
): Promise<{ error?: string }> {
  const user = await requirePermission('contracts', 'edit')
  const supabase = await createClient()

  // Cancel pending schedule rows from the given date onwards
  const { error: schedErr } = await supabase
    .from('contract_invoice_schedule')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('contract_id', contractId)
    .eq('status', 'pending')
    .gte('scheduled_date', cancelDate)

  if (schedErr) return { error: schedErr.message }

  // Update contract
  const { error: conErr } = await supabase
    .from('customer_contracts')
    .update({
      renewal_status: 'cancelled',
      end_date: cancelDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (conErr) return { error: conErr.message }

  const { data: c } = await supabase.from('customer_contracts').select('contract_number').eq('id', contractId).single()

  logActivity({
    supabase, user,
    entityType: 'contract',
    entityId: contractId,
    action: 'rolling_contract_cancelled',
    details: { cancel_date: cancelDate, contract_number: c?.contract_number },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')
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
