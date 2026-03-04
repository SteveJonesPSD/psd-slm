/**
 * Inbound PO processing pipeline — orchestrates extraction, AI parsing, and matching
 *
 * IMPORTANT: This runs fire-and-forget after the upload response is sent.
 * It uses the admin (service-role) client because the cookie-based client
 * loses auth context once the HTTP response completes.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { extractTextFromPDF } from './extract'
import { extractStructuredData } from './ai-extract'
import { matchToQuote, matchLines } from './match'
import type { AuthUser } from '@/lib/auth'

/**
 * Full processing pipeline for an uploaded inbound PO.
 * Updates the database record at each stage.
 */
export async function processInboundPO(
  inboundPoId: string,
  pdfBuffer: Buffer,
  orgId: string,
  apiKey: string | null,
  user: AuthUser
): Promise<void> {
  // Use admin client — this runs async after the response is sent,
  // so the cookie-based client's auth context is no longer valid
  const supabase = createAdminClient()

  try {
    // Update status to extracting
    const { error: statusErr } = await supabase
      .from('inbound_purchase_orders')
      .update({ status: 'extracting' })
      .eq('id', inboundPoId)

    if (statusErr) {
      console.error('[pipeline] Failed to update status to extracting:', statusErr.message)
    }

    // Step 1: Extract text from PDF
    let rawText: string
    let extractionMethod: 'text_layer' | 'ocr_vision'

    if (!apiKey) {
      // No API key — try native extraction only
      // Import inner module directly — pdf-parse/index.js has a debug check
      // that tries to read a test PDF when bundled by Next.js
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse')
      const result = await pdfParse(pdfBuffer)
      rawText = result.text || ''
      extractionMethod = 'text_layer'

      if (rawText.replace(/\s/g, '').length < 50) {
        // Can't do OCR without API key
        await supabase
          .from('inbound_purchase_orders')
          .update({
            status: 'error',
            error_message: 'PDF appears to be scanned but no Claude API key is configured for OCR. Please add an API key in Settings or enter the PO data manually.',
            raw_extracted_text: rawText || null,
            extraction_method: 'text_layer',
            extraction_confidence: 'failed',
          })
          .eq('id', inboundPoId)
        return
      }
    } else {
      const extraction = await extractTextFromPDF(pdfBuffer, apiKey)
      rawText = extraction.rawText
      extractionMethod = extraction.method
    }

    console.log(`[pipeline] ${inboundPoId}: Extracted ${rawText.length} chars via ${extractionMethod}`)

    // Step 2: AI structured extraction
    let extractionConfidence: 'high' | 'medium' | 'low' | 'failed' = 'failed'
    let extractedData = null
    let customerPoNumber: string | null = null
    let customerName: string | null = null
    let contactName: string | null = null
    let poDate: string | null = null
    let totalValue: number | null = null
    let deliveryAddress: string | null = null
    let specialInstructions: string | null = null
    let ourReference: string | null = null

    if (apiKey && rawText.length > 0) {
      console.log(`[pipeline] ${inboundPoId}: Starting AI extraction...`)
      const { data, confidence } = await extractStructuredData(rawText, apiKey)
      extractionConfidence = confidence
      extractedData = data

      console.log(`[pipeline] ${inboundPoId}: AI extraction completed — confidence: ${confidence}, PO#: ${data.customer_po_number}, lines: ${data.line_items?.length || 0}`)

      customerPoNumber = data.customer_po_number
      customerName = data.customer_name
      contactName = data.contact_name
      poDate = data.po_date
      totalValue = data.total_value
      deliveryAddress = data.delivery_address
      specialInstructions = data.special_instructions
      ourReference = data.our_reference

      // Insert extracted line items
      if (data.line_items && data.line_items.length > 0) {
        const lineRows = data.line_items.map((line, idx) => ({
          inbound_po_id: inboundPoId,
          line_number: line.line_number || idx + 1,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_total: line.line_total,
          product_code: line.product_code,
          sort_order: idx,
        }))

        const { error: linesErr } = await supabase.from('inbound_po_lines').insert(lineRows)
        if (linesErr) {
          console.error(`[pipeline] ${inboundPoId}: Failed to insert lines:`, linesErr.message)
        }
      }
    } else if (!apiKey) {
      console.log(`[pipeline] ${inboundPoId}: No API key — skipping AI extraction. Raw text saved.`)
    } else {
      console.log(`[pipeline] ${inboundPoId}: No raw text extracted — skipping AI extraction.`)
    }

    // Log extraction activity
    logActivity(supabase, orgId, user.id, 'inbound_po', inboundPoId, 'extracted', {
      method: extractionMethod,
      confidence: extractionConfidence,
    })

    // Step 3: Quote matching
    let status: 'pending_review' | 'matched' | 'error' = 'pending_review'
    let matchedCompanyId: string | null = null
    let matchedQuoteId: string | null = null
    let matchConfidence: 'exact' | 'high' | 'low' | 'none' = 'none'
    let matchMethod: string | null = null

    if (extractedData && extractionConfidence !== 'failed') {
      const matchResult = await matchToQuote(supabase, orgId, extractedData)
      matchedCompanyId = matchResult.matched_company_id
      matchedQuoteId = matchResult.matched_quote_id
      matchConfidence = matchResult.match_confidence
      matchMethod = matchResult.match_method

      console.log(`[pipeline] ${inboundPoId}: Match result — confidence: ${matchConfidence}, method: ${matchMethod}, quote: ${matchedQuoteId}`)

      // If we have a quote match, also match lines
      if (matchedQuoteId && extractedData.line_items.length > 0) {
        const lineMatches = await matchLines(supabase, matchedQuoteId, extractedData.line_items)

        // Update line records with match info
        const { data: poLines } = await supabase
          .from('inbound_po_lines')
          .select('id')
          .eq('inbound_po_id', inboundPoId)
          .order('sort_order')

        if (poLines) {
          for (let i = 0; i < lineMatches.length && i < poLines.length; i++) {
            const lm = lineMatches[i]
            if (lm.matched_quote_line_id) {
              await supabase
                .from('inbound_po_lines')
                .update({
                  matched_quote_line_id: lm.matched_quote_line_id,
                  line_match_confidence: lm.confidence,
                })
                .eq('id', poLines[i].id)
            }
          }
        }

        status = 'matched'
      } else if (matchConfidence === 'exact' || matchConfidence === 'high') {
        status = 'matched'
      }

      // Log match activity + notify uploader
      if (matchedQuoteId) {
        logActivity(supabase, orgId, user.id, 'inbound_po', inboundPoId, 'matched', {
          quote_id: matchedQuoteId,
          match_method: matchMethod,
          match_confidence: matchConfidence,
        })

        createNotification(supabase, orgId, user.id, 'inbound_po_matched',
          'PO Auto-Matched',
          `Inbound PO${customerPoNumber ? ` ${customerPoNumber}` : ''} has been matched to a quote with ${matchConfidence} confidence.`,
          `/inbound-pos/${inboundPoId}`,
          'inbound_po', inboundPoId
        )
      }
    }

    // Update the main record with all results
    const { error: updateErr } = await supabase
      .from('inbound_purchase_orders')
      .update({
        status,
        extraction_method: extractionMethod,
        extraction_confidence: extractionConfidence,
        raw_extracted_text: rawText,
        extracted_data: extractedData,
        customer_po_number: customerPoNumber,
        customer_name: customerName,
        contact_name: contactName,
        po_date: poDate,
        total_value: totalValue,
        delivery_address: deliveryAddress,
        special_instructions: specialInstructions,
        our_reference: ourReference,
        matched_company_id: matchedCompanyId,
        matched_quote_id: matchedQuoteId,
        match_confidence: matchConfidence,
        match_method: matchMethod,
      })
      .eq('id', inboundPoId)

    if (updateErr) {
      console.error(`[pipeline] ${inboundPoId}: Failed to update final results:`, updateErr.message)
    } else {
      console.log(`[pipeline] ${inboundPoId}: Complete — status: ${status}`)
    }
  } catch (err) {
    console.error('[pipeline] Processing failed:', err)

    const errorMessage = err instanceof Error ? err.message : 'Unknown processing error'

    await supabase
      .from('inbound_purchase_orders')
      .update({
        status: 'error',
        error_message: errorMessage,
      })
      .eq('id', inboundPoId)

    createNotification(supabase, orgId, user.id, 'inbound_po_failed',
      'PO Processing Failed',
      `Failed to process inbound PO: ${errorMessage}`,
      `/inbound-pos/${inboundPoId}`,
      'inbound_po', inboundPoId
    )
  }
}

// --- Inline helpers to avoid importing supabase-dependent modules that expect AuthUser ---

function logActivity(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  details: Record<string, unknown>
) {
  supabase
    .from('activity_log')
    .insert({ org_id: orgId, user_id: userId, entity_type: entityType, entity_id: entityId, action, details })
    .then(({ error }) => { if (error) console.error('[pipeline:activity-log]', error.message) })
}

function createNotification(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  entityType: string,
  entityId: string
) {
  supabase
    .from('notifications')
    .insert({ org_id: orgId, user_id: userId, type, title, message, link, entity_type: entityType, entity_id: entityId })
    .then(({ error }) => { if (error) console.error('[pipeline:notifications]', error.message) })
}
