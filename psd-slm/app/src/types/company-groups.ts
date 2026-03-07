export type GroupType = 'group' | 'mat' | 'franchise' | 'nhs_trust'
export type BillingModel = 'individual' | 'centralised'

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  group: 'Group',
  mat: 'Multi Academy Trust',
  franchise: 'Franchise',
  nhs_trust: 'NHS Trust',
}

export interface CompanyGroup {
  id: string
  org_id: string
  name: string
  parent_company_id: string
  group_type: GroupType
  billing_model: BillingModel
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  parent_company?: { id: string; name: string; account_number: string }
  members?: CompanyGroupMember[]
  member_count?: number
}

export interface CompanyGroupMember {
  id: string
  org_id: string
  group_id: string
  company_id: string
  colour: string
  display_order: number
  created_at: string
  company?: { id: string; name: string; account_number: string }
}

export const GROUP_MEMBER_COLOURS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
]
