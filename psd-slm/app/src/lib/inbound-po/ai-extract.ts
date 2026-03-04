/**
 * Claude AI structured extraction — parses raw PO text into structured data
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedPOData, ExtractedLineItem } from './types'

const EXTRACTION_PROMPT = `You are processing a purchase order document. Extract the following structured data from the text provided.

You MUST return a JSON object with EXACTLY these field names:
{
  "customer_po_number": "The customer's PO/order number",
  "customer_name": "The company/organisation placing the order",
  "contact_name": "The person named on the PO (buyer/contact)",
  "po_date": "The date on the PO in YYYY-MM-DD format",
  "total_value": 0.00,
  "delivery_address": "Full delivery address if specified",
  "special_instructions": "Any delivery notes, special instructions, or terms",
  "our_reference": "Any reference to the supplier's quote number (e.g. Q-2026-0001, ES-2026-0001, SC-2026-0001)",
  "line_items": [
    {
      "line_number": 1,
      "description": "Product/service description",
      "quantity": 1,
      "unit_price": 0.00,
      "line_total": 0.00,
      "product_code": "SKU or part number if shown"
    }
  ],
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find in the document
- Use EXACTLY the field names shown above — do not rename or restructure them
- For total_value, use the net/subtotal (excluding VAT) if both are shown
- For our_reference, look for patterns like Q-YYYY-NNNN, ES-YYYY-NNNN, SC-YYYY-NNNN, or any "your ref" / "quote ref" field
- confidence should be "high" if most fields are clearly readable, "medium" if some are ambiguous, "low" if the document is hard to parse
- Return ONLY valid JSON, no markdown fencing or commentary`

/**
 * Use Claude to extract structured data from raw PO text.
 * One retry on API failure with 2s delay.
 */
export async function extractStructuredData(
  rawText: string,
  apiKey: string
): Promise<{ data: ExtractedPOData; confidence: 'high' | 'medium' | 'low' | 'failed' }> {
  const client = new Anthropic({ apiKey })

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT ---\n${rawText}`,
          },
        ],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock?.text) {
        throw new Error('No text in response')
      }

      // Strip any markdown fencing just in case
      let jsonStr = textBlock.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const raw = JSON.parse(jsonStr) as Record<string, unknown>

      console.log('[ai-extract] Raw parsed keys:', Object.keys(raw))
      console.log('[ai-extract] Raw parsed data:', JSON.stringify(raw, null, 2))

      // Normalize: ensure all expected fields exist with correct names,
      // falling back to common alternative names Claude might use
      const data = normalizeExtractedData(raw)
      const confidence = normalizeConfidence(raw.confidence)

      console.log('[ai-extract] Normalized:', JSON.stringify({
        customer_po_number: data.customer_po_number,
        customer_name: data.customer_name,
        total_value: data.total_value,
        line_items_count: data.line_items.length,
        confidence,
      }))

      return { data, confidence }
    } catch (err) {
      console.error(`[ai-extract] Attempt ${attempt + 1} failed:`, err)
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  // Both attempts failed
  return {
    data: {
      customer_po_number: null,
      customer_name: null,
      contact_name: null,
      po_date: null,
      total_value: null,
      delivery_address: null,
      special_instructions: null,
      our_reference: null,
      line_items: [],
      confidence: 'low',
    },
    confidence: 'failed',
  }
}

/**
 * Normalize the parsed JSON into our expected structure.
 * Handles alternative field names Claude might use.
 */
function normalizeExtractedData(raw: Record<string, unknown>): ExtractedPOData {
  const str = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = raw[k]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return null
  }

  const num = (keys: string[]): number | null => {
    for (const k of keys) {
      const v = raw[k]
      if (typeof v === 'number') return v
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
        if (!isNaN(n)) return n
      }
    }
    return null
  }

  // Normalize line items
  const rawLines = raw.line_items ?? raw.lines ?? raw.items ?? []
  const lineItems: ExtractedLineItem[] = Array.isArray(rawLines)
    ? rawLines.map((l: Record<string, unknown>, i: number) => ({
        line_number: typeof l.line_number === 'number' ? l.line_number : i + 1,
        description: typeof l.description === 'string' ? l.description : (typeof l.item === 'string' ? l.item : null),
        quantity: typeof l.quantity === 'number' ? l.quantity : (typeof l.qty === 'number' ? l.qty : null),
        unit_price: typeof l.unit_price === 'number' ? l.unit_price : (typeof l.price === 'number' ? l.price : null),
        line_total: typeof l.line_total === 'number' ? l.line_total : (typeof l.total === 'number' ? l.total : null),
        product_code: typeof l.product_code === 'string' ? l.product_code : (typeof l.sku === 'string' ? l.sku : null),
      }))
    : []

  return {
    customer_po_number: str(['customer_po_number', 'po_number', 'purchase_order_number', 'order_number']),
    customer_name: str(['customer_name', 'company_name', 'company', 'customer', 'buyer', 'organisation', 'organization']),
    contact_name: str(['contact_name', 'contact', 'buyer_name', 'ordered_by', 'attention']),
    po_date: str(['po_date', 'date', 'order_date', 'purchase_date']),
    total_value: num(['total_value', 'total', 'subtotal', 'net_total', 'total_amount', 'order_total', 'net_amount']),
    delivery_address: str(['delivery_address', 'deliver_to', 'shipping_address', 'ship_to', 'delivery']),
    special_instructions: str(['special_instructions', 'instructions', 'notes', 'delivery_notes', 'comments']),
    our_reference: str(['our_reference', 'your_reference', 'your_ref', 'quote_reference', 'quote_number', 'quote_ref', 'supplier_reference']),
    line_items: lineItems,
    confidence: normalizeConfidence(raw.confidence) as 'high' | 'medium' | 'low',
  }
}

function normalizeConfidence(val: unknown): 'high' | 'medium' | 'low' {
  if (typeof val === 'string') {
    const lower = val.toLowerCase()
    if (lower === 'high') return 'high'
    if (lower === 'medium') return 'medium'
    if (lower === 'low') return 'low'
  }
  return 'medium'
}
