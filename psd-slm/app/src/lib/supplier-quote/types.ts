/**
 * Types for supplier quote PDF/email extraction and product matching
 */

export interface ExtractedSupplierQuote {
  supplier_name: string | null
  supplier_reference: string | null
  quote_date: string | null
  valid_until: string | null
  total_value: number | null
  currency: string | null
  line_items: ExtractedSupplierLine[]
  confidence: 'high' | 'medium' | 'low'
  sender_email: string | null
  sender_name: string | null
}

export interface ExtractedSupplierLine {
  line_number: number
  description: string | null
  quantity: number | null
  unit_price: number | null
  line_total: number | null
  product_code: string | null
  manufacturer_part: string | null
}

export interface ProductMatchResult {
  line_index: number
  matched_product_id: string | null
  matched_product_name: string | null
  matched_product_sku: string | null
  match_method: 'sku_exact' | 'supplier_sku' | 'manufacturer_part' | 'fuzzy_description' | null
  match_confidence: 'exact' | 'high' | 'low' | 'none'
  suggested_products: SuggestedProduct[]
  default_sell_price: number | null
}

export interface SuggestedProduct {
  id: string
  name: string
  sku: string | null
  default_sell_price: number
  score: number
}

export interface SupplierMatchResult {
  matched_supplier_id: string | null
  matched_supplier_name: string | null
  match_confidence: 'exact' | 'high' | 'low' | 'none'
  match_method?: 'name_exact' | 'email_domain' | 'name_contains' | 'name_fuzzy' | null
}
