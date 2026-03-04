/**
 * Quote matching algorithm for inbound POs
 * Priority: reference match → company+value match → company-only → no match
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedPOData, MatchResult, LineMatch } from './types'

const VALUE_TOLERANCE = 0.05 // 5% tolerance for value matching

/**
 * Attempt to match an inbound PO to an existing quote.
 */
export async function matchToQuote(
  supabase: SupabaseClient,
  orgId: string,
  extracted: ExtractedPOData
): Promise<MatchResult> {
  // 1. Reference match: our_reference → quotes.quote_number
  if (extracted.our_reference) {
    const refMatch = await tryReferenceMatch(supabase, orgId, extracted.our_reference, extracted.customer_name)
    if (refMatch) return refMatch
  }

  // 2. Company + value match
  if (extracted.customer_name) {
    const companyId = await findCompanyByName(supabase, orgId, extracted.customer_name)

    if (companyId && extracted.total_value) {
      const valueMatch = await tryCompanyValueMatch(supabase, orgId, companyId, extracted.total_value)
      if (valueMatch) return valueMatch
    }

    // 3. Company-only match
    if (companyId) {
      return {
        matched_company_id: companyId,
        matched_quote_id: null,
        match_confidence: 'low',
        match_method: 'company_only',
        line_matches: [],
      }
    }
  }

  // 4. No match
  return {
    matched_company_id: null,
    matched_quote_id: null,
    match_confidence: 'none',
    match_method: null,
    line_matches: [],
  }
}

/**
 * Match quote lines against extracted PO lines
 */
export async function matchLines(
  supabase: SupabaseClient,
  quoteId: string,
  extractedLines: ExtractedPOData['line_items']
): Promise<LineMatch[]> {
  const { data: quoteLines } = await supabase
    .from('quote_lines')
    .select('id, description, quantity, sell_price')
    .eq('quote_id', quoteId)
    .order('sort_order')

  if (!quoteLines || quoteLines.length === 0) return []

  return extractedLines.map((poLine, index) => {
    let bestMatch: { id: string; confidence: 'exact' | 'high' | 'low' | 'none' } = {
      id: '',
      confidence: 'none',
    }

    for (const ql of quoteLines) {
      // Exact: description + quantity + price all match
      const descMatch = fuzzyMatch(poLine.description || '', ql.description)
      const qtyMatch = poLine.quantity !== null && poLine.quantity === ql.quantity
      const priceMatch = poLine.unit_price !== null && Math.abs(poLine.unit_price - ql.sell_price) < 0.01

      if (descMatch && qtyMatch && priceMatch) {
        bestMatch = { id: ql.id, confidence: 'exact' }
        break
      }

      // High: description matches + (quantity OR price matches)
      if (descMatch && (qtyMatch || priceMatch)) {
        if (bestMatch.confidence !== 'exact') {
          bestMatch = { id: ql.id, confidence: 'high' }
        }
      }

      // Low: only description matches
      if (descMatch && bestMatch.confidence === 'none') {
        bestMatch = { id: ql.id, confidence: 'low' }
      }
    }

    return {
      inbound_line_index: index,
      matched_quote_line_id: bestMatch.id || null,
      confidence: bestMatch.confidence,
    }
  })
}

// --- Internal helpers ---

async function tryReferenceMatch(
  supabase: SupabaseClient,
  orgId: string,
  reference: string,
  customerName: string | null
): Promise<MatchResult | null> {
  const cleaned = reference.trim()

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, customer_id, customers(id, name)')
    .eq('org_id', orgId)
    .eq('quote_number', cleaned)
    .limit(1)

  if (!quotes || quotes.length === 0) return null

  const quote = quotes[0]
  const customer = quote.customers as unknown as { id: string; name: string } | null

  // If customer name provided, verify it matches (case-insensitive)
  if (customerName && customer) {
    const nameMatch = fuzzyMatch(customerName, customer.name)
    if (!nameMatch) {
      // Reference found but company doesn't match — still report as high confidence
      return {
        matched_company_id: customer.id,
        matched_quote_id: quote.id,
        match_confidence: 'high',
        match_method: 'reference_company_mismatch',
        line_matches: [],
      }
    }
  }

  return {
    matched_company_id: quote.customer_id,
    matched_quote_id: quote.id,
    match_confidence: 'exact',
    match_method: 'reference',
    line_matches: [],
  }
}

async function findCompanyByName(
  supabase: SupabaseClient,
  orgId: string,
  customerName: string
): Promise<string | null> {
  const cleaned = customerName.trim().toLowerCase()

  // Try exact match first (case-insensitive)
  const { data: exact } = await supabase
    .from('customers')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', cleaned)
    .limit(1)

  if (exact && exact.length > 0) return exact[0].id

  // Try contains match
  const { data: fuzzy } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', orgId)
    .ilike('name', `%${cleaned}%`)

  if (fuzzy && fuzzy.length === 1) return fuzzy[0].id

  // Try reverse contains (PO name contains our customer name)
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (allCustomers) {
    const match = allCustomers.find((c) =>
      cleaned.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cleaned)
    )
    if (match) return match.id
  }

  return null
}

async function tryCompanyValueMatch(
  supabase: SupabaseClient,
  orgId: string,
  companyId: string,
  totalValue: number
): Promise<MatchResult | null> {
  // Find sent or accepted quotes for this company
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_id')
    .eq('org_id', orgId)
    .eq('customer_id', companyId)
    .in('status', ['sent', 'accepted'])

  if (!quotes || quotes.length === 0) return null

  // For each quote, check if total is within tolerance
  const matchingQuotes: string[] = []

  for (const quote of quotes) {
    const { data: lines } = await supabase
      .from('quote_lines')
      .select('quantity, sell_price, is_optional')
      .eq('quote_id', quote.id)
      .eq('is_optional', false)

    if (lines) {
      const quoteTotal = lines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
      const diff = Math.abs(quoteTotal - totalValue) / Math.max(quoteTotal, 1)
      if (diff <= VALUE_TOLERANCE) {
        matchingQuotes.push(quote.id)
      }
    }
  }

  if (matchingQuotes.length === 1) {
    return {
      matched_company_id: companyId,
      matched_quote_id: matchingQuotes[0],
      match_confidence: 'high',
      match_method: 'company_value',
      line_matches: [],
    }
  }

  return null
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true

  // Token overlap: if >60% of tokens match
  const tokensA = na.split(' ').filter(Boolean)
  const tokensB = nb.split(' ').filter(Boolean)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const overlap = tokensA.filter((t) => tokensB.includes(t)).length
  const minLen = Math.min(tokensA.length, tokensB.length)
  return overlap / minLen > 0.6
}
