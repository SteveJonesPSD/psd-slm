/**
 * Claude AI structured extraction — parses raw supplier quote/email text into structured data
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedSupplierQuote, ExtractedSupplierLine } from './types'
import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'

const EXTRACTION_PROMPT = `You are processing a supplier quote/proposal document. This is a quote FROM a supplier/distributor TO a reseller — the prices shown are the reseller's BUY prices (cost prices), not the prices they will charge their end customer.

Extract the following structured data from the text provided.

You MUST return a JSON object with EXACTLY these field names:
{
  "supplier_name": "The supplier/distributor/vendor company name",
  "supplier_reference": "The supplier's quote number or reference",
  "quote_date": "Date on the quote in YYYY-MM-DD format",
  "valid_until": "Expiry/validity date in YYYY-MM-DD format",
  "total_value": 0.00,
  "currency": "GBP or USD or EUR etc",
  "line_items": [
    {
      "line_number": 1,
      "description": "Product/service description",
      "quantity": 1,
      "unit_price": 0.00,
      "line_total": 0.00,
      "product_code": "SKU, part number, or vendor product code if shown",
      "manufacturer_part": "Manufacturer part number if different from product_code"
    }
  ],
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find in the document
- Use EXACTLY the field names shown above — do not rename or restructure them
- For total_value, use the net/subtotal (excluding VAT/tax) if both are shown
- For product_code, prefer the supplier's own SKU/product code
- For manufacturer_part, use the OEM/manufacturer part number if it differs from product_code
- If only one part number is shown, put it in product_code and leave manufacturer_part as null
- confidence should be "high" if most fields are clearly readable, "medium" if some are ambiguous, "low" if the document is hard to parse
- Return ONLY valid JSON, no markdown fencing or commentary`

/**
 * Use Claude to extract structured data from raw supplier quote text.
 * One retry on API failure with 2s delay.
 */
export async function extractSupplierQuoteData(
  rawText: string,
  apiKey: string
): Promise<{ data: ExtractedSupplierQuote; confidence: 'high' | 'medium' | 'low' | 'failed' }> {
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
      const data = normalizeExtractedData(raw)
      const confidence = normalizeConfidence(raw.confidence)

      console.log('[supplier-quote-extract] Extracted:', JSON.stringify({
        supplier_name: data.supplier_name,
        supplier_reference: data.supplier_reference,
        total_value: data.total_value,
        line_items_count: data.line_items.length,
        confidence,
      }))

      return { data, confidence }
    } catch (err) {
      console.error(`[supplier-quote-extract] Attempt ${attempt + 1} failed:`, err)
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  // Both attempts failed
  return {
    data: {
      supplier_name: null,
      supplier_reference: null,
      quote_date: null,
      valid_until: null,
      total_value: null,
      currency: null,
      line_items: [],
      confidence: 'low',
      sender_email: null,
      sender_name: null,
    },
    confidence: 'failed',
  }
}

/**
 * Normalize the parsed JSON into our expected structure.
 * Handles alternative field names Claude might use.
 */
function normalizeExtractedData(raw: Record<string, unknown>): ExtractedSupplierQuote {
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
  const lineItems: ExtractedSupplierLine[] = Array.isArray(rawLines)
    ? rawLines.map((l: Record<string, unknown>, i: number) => ({
        line_number: typeof l.line_number === 'number' ? l.line_number : i + 1,
        description: typeof l.description === 'string' ? l.description : (typeof l.item === 'string' ? l.item : null),
        quantity: typeof l.quantity === 'number' ? l.quantity : (typeof l.qty === 'number' ? l.qty : null),
        unit_price: typeof l.unit_price === 'number' ? l.unit_price : (typeof l.price === 'number' ? l.price : null),
        line_total: typeof l.line_total === 'number' ? l.line_total : (typeof l.total === 'number' ? l.total : null),
        product_code: typeof l.product_code === 'string' ? l.product_code : (typeof l.sku === 'string' ? l.sku : (typeof l.part_number === 'string' ? l.part_number : null)),
        manufacturer_part: typeof l.manufacturer_part === 'string' ? l.manufacturer_part : (typeof l.mfr_part === 'string' ? l.mfr_part : (typeof l.oem_part === 'string' ? l.oem_part : null)),
      }))
    : []

  return {
    supplier_name: str(['supplier_name', 'vendor_name', 'company_name', 'company', 'supplier', 'vendor', 'from']),
    supplier_reference: str(['supplier_reference', 'quote_number', 'quote_ref', 'reference', 'ref', 'quotation_number']),
    quote_date: str(['quote_date', 'date', 'issued_date', 'created_date']),
    valid_until: str(['valid_until', 'expiry_date', 'expiry', 'valid_to', 'validity', 'expires']),
    total_value: num(['total_value', 'total', 'subtotal', 'net_total', 'total_amount', 'net_amount', 'grand_total']),
    currency: str(['currency', 'currency_code']) || 'GBP',
    line_items: lineItems,
    confidence: normalizeConfidence(raw.confidence),
    sender_email: str(['sender_email', 'from_email', 'email']),
    sender_name: str(['sender_name', 'from_name']),
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

// --- Email-specific extraction ---

const EMAIL_EXTRACTION_PROMPT = `You are processing an email that contains supplier/distributor pricing for a reseller. The prices shown are the reseller's BUY prices (cost prices), not end-customer prices.

The email may contain:
- Inline pricing in the body text (tables, bullet points, or plain text)
- A forwarded email chain with pricing in an earlier message
- Conversational text around the actual pricing (greetings, signatures, disclaimers)
- Pricing from a supplier quote that was copy-pasted into the email

Extract the following structured data. Focus ONLY on the pricing content — ignore signatures, disclaimers, out-of-office notices, confidentiality notices, and email chain headers (From:/To:/Subject:/Date: lines from forwarded messages).

You MUST return a JSON object with EXACTLY these field names:
{
  "supplier_name": "The supplier/distributor/vendor company name (from email signature, body, or context)",
  "supplier_reference": "Any quote/reference number mentioned",
  "quote_date": "Date in YYYY-MM-DD format if mentioned",
  "valid_until": "Expiry/validity date in YYYY-MM-DD format if mentioned",
  "total_value": 0.00,
  "currency": "GBP or USD or EUR etc",
  "sender_email": "The sender's email address if visible in the email",
  "sender_name": "The sender's name if visible in signature or greeting",
  "line_items": [
    {
      "line_number": 1,
      "description": "Product/service description",
      "quantity": 1,
      "unit_price": 0.00,
      "line_total": 0.00,
      "product_code": "SKU, part number, or vendor product code if shown",
      "manufacturer_part": "Manufacturer part number if different from product_code"
    }
  ],
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find
- Use EXACTLY the field names shown above
- For total_value, use the net/subtotal (excluding VAT/tax) if both are shown
- For product_code, prefer the supplier's own SKU/product code
- For manufacturer_part, use the OEM/manufacturer part number if it differs from product_code
- If only one part number is shown, put it in product_code and leave manufacturer_part as null
- confidence should be "high" if pricing is clearly tabulated, "medium" if prices are mentioned in running text, "low" if you're guessing
- Return ONLY valid JSON, no markdown fencing or commentary`

/**
 * Use Claude to extract structured data from supplier email text.
 * If sender info was pre-extracted from .eml headers, it's passed in and pre-populated.
 */
export async function extractSupplierQuoteFromEmail(
  emailText: string,
  apiKey: string,
  senderEmail?: string | null,
  senderName?: string | null
): Promise<{ data: ExtractedSupplierQuote; confidence: 'high' | 'medium' | 'low' | 'failed' }> {
  const client = new Anthropic({ apiKey })

  let contextPrefix = ''
  if (senderEmail || senderName) {
    contextPrefix = `[Email metadata — From: ${senderName || 'unknown'} <${senderEmail || 'unknown'}>]\n\n`
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${EMAIL_EXTRACTION_PROMPT}\n\n--- EMAIL CONTENT ---\n${contextPrefix}${emailText}`,
          },
        ],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock?.text) {
        throw new Error('No text in response')
      }

      let jsonStr = textBlock.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const raw = JSON.parse(jsonStr) as Record<string, unknown>
      const data = normalizeExtractedData(raw)
      const confidence = normalizeConfidence(raw.confidence)

      // Override sender fields with pre-extracted values if available
      if (senderEmail && !data.sender_email) data.sender_email = senderEmail
      if (senderName && !data.sender_name) data.sender_name = senderName

      console.log('[supplier-email-extract] Extracted:', JSON.stringify({
        supplier_name: data.supplier_name,
        sender_email: data.sender_email,
        line_items_count: data.line_items.length,
        confidence,
      }))

      return { data, confidence }
    } catch (err) {
      console.error(`[supplier-email-extract] Attempt ${attempt + 1} failed:`, err)
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  return {
    data: {
      supplier_name: null,
      supplier_reference: null,
      quote_date: null,
      valid_until: null,
      total_value: null,
      currency: null,
      line_items: [],
      confidence: 'low',
      sender_email: senderEmail || null,
      sender_name: senderName || null,
    },
    confidence: 'failed',
  }
}

/**
 * Use Claude Vision to extract supplier pricing from an email screenshot.
 */
export async function extractSupplierQuoteFromScreenshot(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<{ data: ExtractedSupplierQuote; confidence: 'high' | 'medium' | 'low' | 'failed' }> {
  const client = new Anthropic({ apiKey })

  const mediaType = mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              } satisfies ImageBlockParam,
              {
                type: 'text',
                text: EMAIL_EXTRACTION_PROMPT + '\n\nThe image above is a screenshot of a supplier email or quote. Extract the pricing data from what you can see.',
              } satisfies TextBlockParam,
            ],
          },
        ],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock?.text) {
        throw new Error('No text in response')
      }

      let jsonStr = textBlock.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const raw = JSON.parse(jsonStr) as Record<string, unknown>
      const data = normalizeExtractedData(raw)
      const confidence = normalizeConfidence(raw.confidence)

      console.log('[supplier-screenshot-extract] Extracted:', JSON.stringify({
        supplier_name: data.supplier_name,
        sender_email: data.sender_email,
        line_items_count: data.line_items.length,
        confidence,
      }))

      return { data, confidence }
    } catch (err) {
      console.error(`[supplier-screenshot-extract] Attempt ${attempt + 1} failed:`, err)
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  return {
    data: {
      supplier_name: null,
      supplier_reference: null,
      quote_date: null,
      valid_until: null,
      total_value: null,
      currency: null,
      line_items: [],
      confidence: 'low',
      sender_email: null,
      sender_name: null,
    },
    confidence: 'failed',
  }
}
