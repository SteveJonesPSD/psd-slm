export type ContractCategory = 'support' | 'service' | 'licensing'
export type BillingCycleType = 'fixed_date' | 'start_date' | 'go_live_date'
export type EsignStatus = 'not_required' | 'pending' | 'signed' | 'waived'
export type RenewalStatus = 'active' | 'alert_180' | 'alert_90' | 'notice_given' | 'renewal_in_progress' | 'rolling' | 'superseded' | 'expired' | 'cancelled'
export type InvoiceFrequency = 'annual' | 'monthly' | 'quarterly'
export type ScheduleStatus = 'pending' | 'draft_created' | 'sent' | 'skipped' | 'cancelled'

export interface ContractType {
  id: string
  org_id: string
  name: string
  code: string
  description: string | null
  category: ContractCategory
  default_visit_frequency: string | null
  default_visit_length_hours: number | null
  default_visits_per_year: number | null
  includes_remote_support: boolean
  includes_telephone: boolean
  includes_onsite: boolean
  default_sla_plan_id: string | null
  default_monthly_hours: number | null
  allowed_schedule_weeks: number[]
  requires_visit_slots: boolean
  // Billing cycle
  billing_cycle_type: BillingCycleType
  default_billing_month: number | null
  // Service/Licensing billing fields
  default_term_months: number | null
  default_notice_alert_days: number
  secondary_alert_days: number
  auto_invoice: boolean
  invoice_frequency: InvoiceFrequency
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CustomerContract {
  id: string
  org_id: string
  customer_id: string
  contract_type_id: string
  contact_id: string | null
  contract_number: string
  status: string
  parent_contract_id: string | null
  version: number
  visit_frequency: string | null
  visit_length_hours: number | null
  visits_per_year: number | null
  start_date: string
  end_date: string | null
  renewal_period: string
  renewal_month: number | null
  auto_renew: boolean
  annual_value: number | null
  billing_frequency: string
  opportunity_id: string | null
  quote_id: string | null
  esign_request_id: string | null
  last_signed_at: string | null
  signed_by_name: string | null
  sla_plan_id: string | null
  monthly_hours: number | null
  calendar_id: string | null
  account_manager_id: string | null
  renewal_notice_days: number | null
  esign_required: boolean
  // Expansion fields
  source_quote_id: string | null
  billing_cycle_type: BillingCycleType | null
  billing_month: number | null
  billing_day: number
  term_months: number | null
  go_live_date: string | null
  invoice_schedule_start: string | null
  notice_alert_days: number | null
  secondary_alert_days: number | null
  auto_invoice: boolean | null
  invoice_frequency: InvoiceFrequency | null
  is_rolling: boolean
  rolling_frequency: 'monthly' | 'annual' | null
  next_invoice_date: string | null
  renewal_status: RenewalStatus
  superseded_by: string | null
  upgrade_go_live_date: string | null
  esign_status: EsignStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomerContractWithDetails extends CustomerContract {
  calendar_name: string | null
  calendar_schedule_weeks: number | null
  customer_name: string
  contract_type_name: string
  contract_type_code: string
  category: string
  effective_frequency: string | null
  effective_visits_per_year: number | null
  effective_visit_hours: number | null
  includes_remote_support: boolean
  includes_telephone: boolean
  includes_onsite: boolean
  effective_sla_plan_id: string | null
  effective_sla_plan_name: string | null
  effective_monthly_hours: number | null
  contact_name: string | null
  lines?: ContractLine[]
  entitlements?: ContractEntitlement[]
  renewals?: ContractRenewal[]
  visit_slots?: ContractVisitSlotWithDetails[]
}

export interface ContractLine {
  id: string
  customer_contract_id: string
  description: string
  unit_type: string | null
  quantity: number
  unit_price_annual: number | null
  location: string | null
  product_id: string | null
  sort_order: number
  notes: string | null
  // Expansion fields
  source_quote_line_id: string | null
  product_type: string | null
  unit_price: number | null
  buy_price: number | null
  line_type: 'recurring' | 'one_off' | 'usage'
  created_at: string
}

export interface ContractRenewal {
  id: string
  old_contract_id: string
  new_contract_id: string
  previous_end_date: string
  new_start_date: string
  new_end_date: string
  previous_annual_value: number | null
  new_annual_value: number | null
  renewal_method: string
  esign_request_id: string | null
  renewal_quote_id: string | null
  renewal_workflow_status: string
  notes: string | null
  renewed_by: string | null
  renewed_by_name?: string | null
  created_at: string
}

export interface ContractEntitlement {
  id: string
  customer_contract_id: string
  entitlement_type: string
  description: string | null
  is_included: boolean
  sort_order: number
  created_at: string
}

export interface ContractVisitSlot {
  id: string
  customer_contract_id: string
  engineer_id: string
  cycle_week_numbers: number[]
  day_of_week: string
  time_slot: string
  default_start_time: string
  default_end_time: string
  override_start_time: string | null
  override_end_time: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContractVisitSlotWithDetails extends ContractVisitSlot {
  contract_number: string
  customer_id: string
  customer_name: string
  contract_type_name: string
  contract_type_code: string
  engineer_name: string
  effective_start_time: string
  effective_end_time: string
}

export interface FieldEngineer {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
  avatar_url: string | null
}

export interface ContractFormData {
  customer_id: string
  contract_type_id: string
  contact_id?: string | null
  start_date: string
  end_date: string
  renewal_period: string
  renewal_month?: number | null
  auto_renew: boolean
  annual_value: number | null
  billing_frequency: string
  visit_frequency?: string | null
  visit_length_hours?: number | null
  visits_per_year?: number | null
  sla_plan_id?: string | null
  monthly_hours?: number | null
  opportunity_id?: string | null
  quote_id?: string | null
  notes?: string | null
}

export interface RenewalFormData {
  new_start_date: string
  new_end_date: string
  annual_value: number | null
  notes?: string | null
}

export const CONTRACT_CATEGORIES = [
  'support',
  'service',
  'licensing',
] as const

export const CONTRACT_STATUSES = [
  'draft',
  'pending_signature',
  'declined_signature',
  'awaiting_activation',
  'active',
  'renewal_flagged',
  'renewal_sent',
  'renewal_accepted',
  'schedule_pending',
  'not_renewing',
  'expired',
  'cancelled',
  'renewed',
] as const

export const VISIT_FREQUENCIES = [
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
] as const

export const BILLING_FREQUENCIES = [
  'monthly',
  'quarterly',
  'annually',
] as const

export const RENEWAL_PERIODS = [
  'april',
  'september',
  'custom',
] as const

export const INVOICE_FREQUENCIES = [
  'annual',
  'monthly',
  'quarterly',
] as const

export const TERM_MONTH_OPTIONS = [
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
  { value: 60, label: '60 months' },
] as const

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  active: 'Active',
  alert_180: '180-Day Alert',
  alert_90: '90-Day Alert',
  notice_given: 'Notice Given',
  renewal_in_progress: 'Renewal In Progress',
  rolling: 'Rolling',
  superseded: 'Superseded',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export const ESIGN_STATUS_LABELS: Record<EsignStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  signed: 'Signed',
  waived: 'Waived',
}

export interface PricebookLine {
  id: string
  org_id: string
  contract_type_id: string
  description: string
  annual_price: number
  vat_rate: number
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export const BILLING_CYCLE_LABELS: Record<BillingCycleType, string> = {
  fixed_date: 'Fixed Date (Apr/Sep)',
  start_date: 'Start Date Anniversary',
  go_live_date: 'Go-Live Date',
}

export const BILLING_MONTH_OPTIONS = [
  { value: 4, label: 'April' },
  { value: 9, label: 'September' },
] as const

// Helper: next billing date from a given date and billing month
export function getNextBillingDate(fromDate: Date, billingMonth: number, billingDay: number = 1): Date {
  const year = fromDate.getFullYear()
  const candidate = new Date(year, billingMonth - 1, billingDay)
  if (candidate <= fromDate) {
    return new Date(year + 1, billingMonth - 1, billingDay)
  }
  return candidate
}

// New types for invoice schedule and alerts
export interface ContractInvoiceSchedule {
  id: string
  org_id: string
  contract_id: string
  scheduled_date: string
  period_label: string
  period_start: string
  period_end: string
  base_amount: number
  amount_override: number | null
  invoice_id: string | null
  is_prorata: boolean
  prorata_days: number | null
  prorata_total_days: number | null
  status: ScheduleStatus
  notes: string | null
  created_at: string
  updated_at: string
  // view-joined
  effective_amount?: number
  contract_number?: string
  customer_name?: string
  category?: string
  invoice_number?: string | null
  invoice_status?: string | null
}

export interface ContractLineSupplierPrice {
  id: string
  org_id: string
  contract_line_id: string
  supplier_id: string | null
  product_id: string | null
  current_buy_price: number | null
  last_checked_at: string | null
  price_source: string | null
  notes: string | null
  created_at: string
}

export interface PendingInvoiceAlert {
  contract_id: string
  contract_number: string
  customer_name: string
  schedule_id: string
  scheduled_date: string
  period_label: string
  effective_amount: number
}

export interface ExpiringContractAlert {
  contract_id: string
  contract_number: string
  customer_name: string
  end_date: string
  days_remaining: number
  alert_level: 'alert_180' | 'alert_90'
  category: ContractCategory
}

export interface ContractEligibleQuoteLine {
  id: string
  description: string
  product_id: string | null
  product_type: string
  quantity: number
  unit_price: number
  buy_price: number
  sell_price: number
  group_name: string | null
}

export interface CreateSupportContractPayload {
  customer_id: string
  contract_type_id: string
  contact_id?: string | null
  start_date: string
  end_date?: string | null
  billing_cycle_type: BillingCycleType
  billing_month?: number
  annual_value: number
  lines: Array<{
    description: string
    annual_price: number
    vat_rate: number
    sort_order: number
  }>
  source_quote_id?: string
  notes?: string | null
  calendar_id?: string | null
  sla_plan_id?: string | null
  monthly_hours?: number | null
  visit_frequency?: string | null
  visit_length_hours?: number | null
  visits_per_year?: number | null
}

export interface CreateContractFromLinesPayload {
  quote_id: string
  customer_id: string
  contract_type_id: string
  selected_line_ids: string[]
  go_live_date: string
  term_months: number | null
  notice_alert_days: number
  secondary_alert_days: number
  auto_invoice: boolean
  invoice_frequency: InvoiceFrequency
  annual_value: number
}
