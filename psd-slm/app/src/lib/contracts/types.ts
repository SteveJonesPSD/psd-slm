export interface ContractType {
  id: string
  org_id: string
  name: string
  code: string
  description: string | null
  category: string
  default_visit_frequency: string | null
  default_visit_length_hours: number | null
  default_visits_per_year: number | null
  includes_remote_support: boolean
  includes_telephone: boolean
  includes_onsite: boolean
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
  end_date: string
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
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomerContractWithDetails extends CustomerContract {
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
  'ict',
  'access_control',
  'cctv',
  'telephony',
  'maintenance',
  'bespoke',
] as const

export const CONTRACT_STATUSES = [
  'draft',
  'pending_signature',
  'active',
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
