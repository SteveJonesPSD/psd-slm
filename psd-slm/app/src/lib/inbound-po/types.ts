/**
 * Pipeline-internal types for inbound PO processing
 */

export interface ExtractedPOData {
  customer_po_number: string | null
  customer_name: string | null
  contact_name: string | null
  po_date: string | null
  total_value: number | null
  delivery_address: string | null
  special_instructions: string | null
  our_reference: string | null
  line_items: ExtractedLineItem[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ExtractedLineItem {
  line_number: number
  description: string | null
  quantity: number | null
  unit_price: number | null
  line_total: number | null
  product_code: string | null
}

export interface ExtractionResult {
  rawText: string
  method: 'text_layer' | 'ocr_vision'
}

export interface MatchResult {
  matched_company_id: string | null
  matched_quote_id: string | null
  match_confidence: 'exact' | 'high' | 'low' | 'none'
  match_method: string | null
  line_matches: LineMatch[]
}

export interface LineMatch {
  inbound_line_index: number
  matched_quote_line_id: string | null
  confidence: 'exact' | 'high' | 'low' | 'none'
}
