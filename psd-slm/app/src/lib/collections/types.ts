export interface JobCollection {
  id: string
  org_id: string
  job_id: string
  sales_order_id: string | null
  slip_number: string
  slip_token: string
  status: 'pending' | 'collected' | 'partial' | 'cancelled'
  prepared_by: string | null
  prepared_at: string
  collected_by: string | null
  collected_at: string | null
  collection_latitude: number | null
  collection_longitude: number | null
  collection_accuracy: number | null
  engineer_signature_path: string | null
  engineer_name: string | null
  engineer_initials: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface JobCollectionLine {
  id: string
  collection_id: string
  sales_order_line_id: string | null
  product_id: string
  description: string
  quantity_expected: number
  quantity_confirmed: number
  expected_serials: string[] | null
  confirmed_serials: string[] | null
  is_confirmed: boolean
  confirmed_at: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface JobCollectionWithDetails extends JobCollection {
  // Supabase join names match table names
  jobs?: { id: string; job_number: string; title: string; assigned_to?: string | null }
  sales_orders?: { id: string; so_number: string; customer_id?: string; customers?: { id: string; name: string } | null }
  prepared_by_user?: { id: string; first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null }
  collected_by_user?: { id: string; first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null }
  job_collection_lines?: JobCollectionLineWithProduct[]
}

export interface JobCollectionLineWithProduct extends JobCollectionLine {
  product?: { id: string; sku: string; name: string }
}

/** Minimal shape for the public magic link page (no auth, no sensitive data) */
export interface CollectionSlipPublic {
  id: string
  slip_number: string
  status: 'pending' | 'collected' | 'partial' | 'cancelled'
  collected_at: string | null
  collected_by_name: string | null
  customer_name: string
  job_number: string
  job_id: string
  notes: string | null
  lines: {
    id: string
    description: string
    quantity_expected: number
    quantity_confirmed: number
    expected_serials: string[] | null
    confirmed_serials: string[] | null
    is_confirmed: boolean
    notes: string | null
    sort_order: number
  }[]
}

export const COLLECTION_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'amber' },
  collected: { label: 'Collected', color: 'green' },
  partial: { label: 'Partial', color: 'blue' },
  cancelled: { label: 'Cancelled', color: 'gray' },
} as const

export interface CreateCollectionLineInput {
  sales_order_line_id?: string
  product_id: string
  description: string
  quantity_expected: number
  expected_serials?: string[]
  notes?: string
  sort_order?: number
}
