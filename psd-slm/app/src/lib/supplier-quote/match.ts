/**
 * Product matching for supplier quote lines — matches against product catalogue
 * Priority: SKU exact → supplier SKU → manufacturer part → fuzzy description
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedSupplierLine, ProductMatchResult, SuggestedProduct, SupplierMatchResult } from './types'
import { extractDomain } from './email-extract'

/**
 * Match a supplier name (and optionally email domain) against the suppliers table.
 * Priority: exact name → email domain → contains name → fuzzy name
 */
export async function matchSupplier(
  supabase: SupabaseClient,
  orgId: string,
  supplierName: string,
  senderEmail?: string | null
): Promise<SupplierMatchResult> {
  const cleaned = supplierName.trim().toLowerCase()

  // Fetch all active suppliers once with email + website for domain matching
  const { data: allSuppliers } = await supabase
    .from('suppliers')
    .select('id, name, email, website')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!allSuppliers || allSuppliers.length === 0) {
    return {
      matched_supplier_id: null,
      matched_supplier_name: null,
      match_confidence: 'none',
      match_method: null,
    }
  }

  // Tier 1: Exact name match (case-insensitive)
  const exactMatch = allSuppliers.find((s) => s.name.toLowerCase() === cleaned)
  if (exactMatch) {
    return {
      matched_supplier_id: exactMatch.id,
      matched_supplier_name: exactMatch.name,
      match_confidence: 'exact',
      match_method: 'name_exact',
    }
  }

  // Tier 2: Email domain match (if sender email available)
  if (senderEmail) {
    const senderDomain = extractDomain(senderEmail)
    if (senderDomain) {
      const domainMatch = allSuppliers.find((s) => {
        const emailDomain = s.email ? extractDomain(s.email) : null
        const websiteDomain = s.website ? extractDomain(s.website) : null
        return (emailDomain && emailDomain === senderDomain) ||
               (websiteDomain && websiteDomain === senderDomain)
      })
      if (domainMatch) {
        return {
          matched_supplier_id: domainMatch.id,
          matched_supplier_name: domainMatch.name,
          match_confidence: 'high',
          match_method: 'email_domain',
        }
      }
    }
  }

  // Tier 3: Name contains match (one-way and reverse)
  const containsMatch = allSuppliers.find((s) =>
    cleaned.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleaned)
  )
  if (containsMatch) {
    return {
      matched_supplier_id: containsMatch.id,
      matched_supplier_name: containsMatch.name,
      match_confidence: 'high',
      match_method: 'name_contains',
    }
  }

  // Tier 4: Token overlap fuzzy match
  const fuzzyResult = allSuppliers.find((s) => fuzzyMatch(cleaned, s.name.toLowerCase()))
  if (fuzzyResult) {
    return {
      matched_supplier_id: fuzzyResult.id,
      matched_supplier_name: fuzzyResult.name,
      match_confidence: 'low',
      match_method: 'name_fuzzy',
    }
  }

  return {
    matched_supplier_id: null,
    matched_supplier_name: null,
    match_confidence: 'none',
    match_method: null,
  }
}

/**
 * Match extracted supplier quote lines against the product catalogue.
 */
export async function matchProducts(
  supabase: SupabaseClient,
  orgId: string,
  lines: ExtractedSupplierLine[],
  supplierId: string | null
): Promise<ProductMatchResult[]> {
  // Fetch all products and product_suppliers for this org
  const [{ data: products }, { data: productSuppliers }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, default_sell_price')
      .eq('org_id', orgId),
    supabase
      .from('product_suppliers')
      .select('product_id, supplier_id, supplier_sku')
      .eq('org_id', orgId),
  ])

  const allProducts = products || []
  const allProductSuppliers = productSuppliers || []

  return lines.map((line, index) => {
    // 1. SKU exact match — product_code matches products.sku (case-insensitive)
    if (line.product_code) {
      const skuMatch = allProducts.find(
        (p) => p.sku && p.sku.toLowerCase() === line.product_code!.toLowerCase()
      )
      if (skuMatch) {
        return {
          line_index: index,
          matched_product_id: skuMatch.id,
          matched_product_name: skuMatch.name,
          matched_product_sku: skuMatch.sku,
          match_method: 'sku_exact' as const,
          match_confidence: 'exact' as const,
          suggested_products: [],
          default_sell_price: skuMatch.default_sell_price,
        }
      }

      // 2. Supplier SKU match — product_code matches product_suppliers.supplier_sku
      if (supplierId) {
        const supplierSkuMatch = allProductSuppliers.find(
          (ps) =>
            ps.supplier_id === supplierId &&
            ps.supplier_sku &&
            ps.supplier_sku.toLowerCase() === line.product_code!.toLowerCase()
        )
        if (supplierSkuMatch) {
          const product = allProducts.find((p) => p.id === supplierSkuMatch.product_id)
          if (product) {
            return {
              line_index: index,
              matched_product_id: product.id,
              matched_product_name: product.name,
              matched_product_sku: product.sku,
              match_method: 'supplier_sku' as const,
              match_confidence: 'exact' as const,
              suggested_products: [],
              default_sell_price: product.default_sell_price,
            }
          }
        }
      }

      // Also try supplier SKU across all suppliers if no supplier match yet
      const anySupplierSkuMatch = allProductSuppliers.find(
        (ps) =>
          ps.supplier_sku &&
          ps.supplier_sku.toLowerCase() === line.product_code!.toLowerCase()
      )
      if (anySupplierSkuMatch) {
        const product = allProducts.find((p) => p.id === anySupplierSkuMatch.product_id)
        if (product) {
          return {
            line_index: index,
            matched_product_id: product.id,
            matched_product_name: product.name,
            matched_product_sku: product.sku,
            match_method: 'supplier_sku' as const,
            match_confidence: 'exact' as const,
            suggested_products: [],
            default_sell_price: product.default_sell_price,
          }
        }
      }
    }

    // 3. Manufacturer part match — manufacturer_part matches products.sku
    if (line.manufacturer_part) {
      const mfrMatch = allProducts.find(
        (p) => p.sku && p.sku.toLowerCase() === line.manufacturer_part!.toLowerCase()
      )
      if (mfrMatch) {
        return {
          line_index: index,
          matched_product_id: mfrMatch.id,
          matched_product_name: mfrMatch.name,
          matched_product_sku: mfrMatch.sku,
          match_method: 'manufacturer_part' as const,
          match_confidence: 'high' as const,
          suggested_products: [],
          default_sell_price: mfrMatch.default_sell_price,
        }
      }
    }

    // 4. Description fuzzy match — token overlap >60% against product names
    if (line.description) {
      const suggestions = fuzzyMatchProducts(line.description, allProducts)
      if (suggestions.length > 0 && suggestions[0].score > 0.6) {
        const best = suggestions[0]
        return {
          line_index: index,
          matched_product_id: best.id,
          matched_product_name: best.name,
          matched_product_sku: best.sku,
          match_method: 'fuzzy_description' as const,
          match_confidence: 'low' as const,
          suggested_products: suggestions.slice(0, 3),
          default_sell_price: best.default_sell_price,
        }
      }

      // Return suggestions even if below threshold
      if (suggestions.length > 0) {
        return {
          line_index: index,
          matched_product_id: null,
          matched_product_name: null,
          matched_product_sku: null,
          match_method: null,
          match_confidence: 'none' as const,
          suggested_products: suggestions.slice(0, 3),
          default_sell_price: null,
        }
      }
    }

    // No match
    return {
      line_index: index,
      matched_product_id: null,
      matched_product_name: null,
      matched_product_sku: null,
      match_method: null,
      match_confidence: 'none' as const,
      suggested_products: [],
      default_sell_price: null,
    }
  })
}

// --- Internal helpers ---

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true

  const tokensA = na.split(' ').filter(Boolean)
  const tokensB = nb.split(' ').filter(Boolean)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const overlap = tokensA.filter((t) => tokensB.includes(t)).length
  const minLen = Math.min(tokensA.length, tokensB.length)
  return overlap / minLen > 0.6
}

function fuzzyMatchProducts(
  description: string,
  products: { id: string; name: string; sku: string | null; default_sell_price: number }[]
): SuggestedProduct[] {
  const descNorm = normalize(description)
  const descTokens = descNorm.split(' ').filter(Boolean)
  if (descTokens.length === 0) return []

  const scored = products
    .map((p) => {
      const nameNorm = normalize(p.name)
      const nameTokens = nameNorm.split(' ').filter(Boolean)
      if (nameTokens.length === 0) return null

      const overlap = descTokens.filter((t) => nameTokens.includes(t)).length
      const score = overlap / Math.min(descTokens.length, nameTokens.length)

      if (score < 0.3) return null // Don't suggest very poor matches

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        default_sell_price: p.default_sell_price,
        score,
      }
    })
    .filter((r): r is SuggestedProduct => r !== null)
    .sort((a, b) => b.score - a.score)

  return scored
}
