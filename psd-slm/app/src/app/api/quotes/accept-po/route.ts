import { NextResponse } from 'next/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

interface ExtractedPoData {
  po_number: string | null
  supplier_name: string | null
  customer_name: string | null
  date: string | null
  total_value: number | null
  currency: string | null
  lines: {
    description: string
    quantity: number
    unit_price: number
    line_total: number
  }[]
}

export async function POST(request: Request) {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const supabase = await createClient()

  // Get API key
  const { data: apiKeySetting } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'anthropic_api_key')
    .single()

  const apiKey = (apiKeySetting?.setting_value as string | null) || process.env.ANTHROPIC_API_KEY || null
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured. Add it in Settings > API Keys.' }, { status: 400 })
  }

  const formData = await request.formData()
  const quoteId = formData.get('quote_id') as string
  const inputType = formData.get('input_type') as string // 'pdf' | 'email_text' | 'screenshot'
  const file = formData.get('file') as File | null
  const emailText = formData.get('email_text') as string | null
  const screenshot = formData.get('screenshot') as string | null // base64
  const screenshotType = formData.get('screenshot_type') as string | null

  if (!quoteId) {
    return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 })
  }

  // Fetch the quote for verification
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, status, vat_rate, customer_id,
      customers(name),
      quote_lines(description, quantity, sell_price, is_optional)
    `)
    .eq('id', quoteId)
    .single()

  if (!quote || quoteError) {
    console.error('Quote fetch error:', quoteError)
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Extract text from input
  let documentText = ''
  let extractionMethod = ''

  try {
    if (inputType === 'pdf' && file) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())

      // Try native PDF text extraction first
      try {
        const pdfParse = require('pdf-parse/lib/pdf-parse')
        const result = await pdfParse(buffer)
        if (result.text && result.text.replace(/\s/g, '').length >= 50) {
          documentText = result.text
          extractionMethod = 'text_layer'
        }
      } catch {
        // Fall through to OCR
      }

      // Fallback to Claude Vision OCR
      if (!documentText) {
        const client = new Anthropic({ apiKey })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
              } as Anthropic.DocumentBlockParam,
              {
                type: 'text',
                text: 'Extract ALL text content from this purchase order document. Preserve the structure and layout as much as possible.',
              },
            ],
          }],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        documentText = textBlock?.text || ''
        extractionMethod = 'ocr_vision'
      }
    } else if (inputType === 'email_text' && emailText) {
      if (emailText.trim().length < 50) {
        return NextResponse.json({ error: 'Email text too short (min 50 characters)' }, { status: 400 })
      }
      documentText = emailText
      extractionMethod = 'email_text'
    } else if (inputType === 'screenshot' && screenshot && screenshotType) {
      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: screenshotType as 'image/png' | 'image/jpeg' | 'image/webp', data: screenshot },
            } as Anthropic.ImageBlockParam,
            {
              type: 'text',
              text: 'Extract ALL text content from this purchase order image. Preserve the structure and layout as much as possible.',
            },
          ],
        }],
      })
      const textBlock = response.content.find((b) => b.type === 'text')
      documentText = textBlock?.text || ''
      extractionMethod = 'screenshot_ocr'
    } else {
      return NextResponse.json({ error: 'Invalid input. Provide a PDF, email text, or screenshot.' }, { status: 400 })
    }

    if (!documentText || documentText.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract readable text from the document.' }, { status: 400 })
    }

    // Extract structured PO data via Claude
    const client = new Anthropic({ apiKey })
    const extractionPrompt = `You are extracting data from a customer Purchase Order (PO) document. Extract the following information as JSON:

{
  "po_number": "the PO/order reference number",
  "supplier_name": "the supplier/vendor name (this is OUR company name - the company the PO is addressed TO)",
  "customer_name": "the buyer/customer name (the company ISSUING the PO)",
  "date": "the PO date in YYYY-MM-DD format, or null if not found",
  "total_value": numeric total value (no currency symbol, just the number), or null,
  "currency": "GBP, USD, EUR etc., or null",
  "lines": [
    {
      "description": "line item description",
      "quantity": numeric quantity,
      "unit_price": numeric unit price,
      "line_total": numeric line total
    }
  ]
}

Rules:
- Return ONLY valid JSON, no markdown fencing or explanation
- If a field cannot be determined, use null
- For lines, extract as many as you can find. If no line detail, return empty array.
- Numeric values should be plain numbers (no currency symbols or commas)
- The "supplier_name" is the company the PO is being SENT TO (the seller)
- The "customer_name" is the company SENDING/ISSUING the PO (the buyer)`

    const extractResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: extractionPrompt + '\n\n--- DOCUMENT TEXT ---\n' + documentText,
      }],
    })

    const extractBlock = extractResponse.content.find((b) => b.type === 'text')
    if (!extractBlock?.text) {
      return NextResponse.json({ error: 'AI extraction returned no result' }, { status: 500 })
    }

    let jsonStr = extractBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const extracted: ExtractedPoData = JSON.parse(jsonStr)

    // Build verification against quote
    const customerName = (quote.customers as unknown as { name: string } | null)?.name || ''
    const allLines = (quote.quote_lines as unknown as { description: string; quantity: number; sell_price: number; is_optional: boolean }[]) || []
    const nonOptionalLines = allLines.filter((l) => !l.is_optional)
    const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
    const vatRate = (quote.vat_rate as number) || 0
    const grandTotal = subtotal + subtotal * (vatRate / 100)

    // Customer name matching with fuzzy support
    function normalizeForMatch(s: string): string {
      return s.toLowerCase().replace(/\b(ltd|limited|plc|inc|llc|co|corp|group)\b/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    }
    function customerNameMatch(a: string, b: string): boolean {
      if (!a || !b) return false
      const na = normalizeForMatch(a)
      const nb = normalizeForMatch(b)
      if (na === nb) return true
      if (na.includes(nb) || nb.includes(na)) return true
      // Token overlap
      const tokensA = new Set(na.split(' ').filter(Boolean))
      const tokensB = new Set(nb.split(' ').filter(Boolean))
      if (tokensA.size === 0 || tokensB.size === 0) return false
      const overlap = [...tokensA].filter((t) => tokensB.has(t)).length
      return overlap / Math.max(tokensA.size, tokensB.size) > 0.5
    }

    // Total matching: check against both ex-VAT and inc-VAT
    let totalMatch: boolean | null = null
    let totalMatchType: 'ex_vat' | 'inc_vat' | null = null
    if (extracted.total_value !== null) {
      if (Math.abs(extracted.total_value - subtotal) < 0.01) {
        totalMatch = true
        totalMatchType = 'ex_vat'
      } else if (Math.abs(extracted.total_value - grandTotal) < 0.01) {
        totalMatch = true
        totalMatchType = 'inc_vat'
      } else {
        totalMatch = false
      }
    }

    const verification = {
      po_number: extracted.po_number,
      customer_name_match: extracted.customer_name
        ? customerNameMatch(extracted.customer_name, customerName)
        : null,
      extracted_customer: extracted.customer_name,
      quote_customer: customerName,
      total_match: totalMatch,
      total_match_type: totalMatchType,
      extracted_total: extracted.total_value,
      quote_total_ex_vat: subtotal,
      quote_total_inc_vat: grandTotal,
      total_difference: extracted.total_value !== null
        ? extracted.total_value - (totalMatchType === 'inc_vat' ? grandTotal : subtotal)
        : null,
      line_count_match: extracted.lines.length > 0
        ? extracted.lines.length === nonOptionalLines.length
        : null,
      extracted_line_count: extracted.lines.length,
      quote_line_count: nonOptionalLines.length,
      extracted_lines: extracted.lines,
      extraction_method: extractionMethod,
    }

    // Attach the uploaded PO document to the quote
    let attachmentId: string | null = null
    try {
      if (inputType === 'pdf' && file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
        const storagePath = `${user.orgId}/${quoteId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('quote-attachments')
          .upload(storagePath, file, { contentType: file.type, upsert: false })
        if (!uploadErr) {
          const { data: att } = await supabase.from('quote_attachments').insert({
            quote_id: quoteId,
            org_id: user.orgId,
            file_name: file.name,
            storage_path: storagePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
            label: 'Customer PO',
            source: 'ai_accept',
          }).select('id').single()
          attachmentId = att?.id || null
        }
      } else if (inputType === 'screenshot' && screenshot && screenshotType) {
        const extMap: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
        const ext = extMap[screenshotType] || 'png'
        const storagePath = `${user.orgId}/${quoteId}/${crypto.randomUUID()}.${ext}`
        const buffer = Buffer.from(screenshot, 'base64')
        const { error: uploadErr } = await supabase.storage
          .from('quote-attachments')
          .upload(storagePath, buffer, { contentType: screenshotType, upsert: false })
        if (!uploadErr) {
          const { data: att } = await supabase.from('quote_attachments').insert({
            quote_id: quoteId,
            org_id: user.orgId,
            file_name: `customer-po.${ext}`,
            storage_path: storagePath,
            file_size: buffer.length,
            mime_type: screenshotType,
            uploaded_by: user.id,
            label: 'Customer PO',
            source: 'ai_accept',
          }).select('id').single()
          attachmentId = att?.id || null
        }
      }
    } catch {
      // Attachment is best-effort — don't fail the extraction
    }

    return NextResponse.json({ extracted, verification, attachment_id: attachmentId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
