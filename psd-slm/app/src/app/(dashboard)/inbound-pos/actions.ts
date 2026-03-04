'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { matchToQuote, matchLines } from '@/lib/inbound-po/match'
import { processInboundPO } from '@/lib/inbound-po/pipeline'

// --- List ---

export async function getInboundPOs(statusFilter?: string) {
  const user = await requirePermission('inbound_pos', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('inbound_purchase_orders')
    .select(`
      *,
      customers:matched_company_id(id, name),
      quotes:matched_quote_id(id, quote_number),
      uploader:uploaded_by(id, first_name, last_name),
      reviewer:reviewed_by(id, first_name, last_name)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { data: data || [] }
}

// --- Detail ---

export async function getInboundPO(id: string) {
  const user = await requirePermission('inbound_pos', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inbound_purchase_orders')
    .select(`
      *,
      customers:matched_company_id(id, name),
      quotes:matched_quote_id(id, quote_number, status, customer_id, customers(name)),
      uploader:uploaded_by(id, first_name, last_name),
      reviewer:reviewed_by(id, first_name, last_name)
    `)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }

  // Get lines
  const { data: lines } = await supabase
    .from('inbound_po_lines')
    .select(`
      *,
      quote_line:matched_quote_line_id(id, description, quantity, sell_price, buy_price)
    `)
    .eq('inbound_po_id', id)
    .order('sort_order')

  // Get matched quote lines if matched
  let quoteLines = null
  if (data.matched_quote_id) {
    const { data: ql } = await supabase
      .from('quote_lines')
      .select('id, description, quantity, sell_price, buy_price, sort_order')
      .eq('quote_id', data.matched_quote_id)
      .order('sort_order')
    quoteLines = ql
  }

  // Get signed PDF URL
  let pdfUrl = null
  if (data.pdf_storage_path) {
    const { data: signedUrl } = await supabase.storage
      .from('inbound-pos')
      .createSignedUrl(data.pdf_storage_path, 3600) // 1 hour
    pdfUrl = signedUrl?.signedUrl || null
  }

  return {
    data: {
      ...data,
      lines: lines || [],
      quoteLines,
      pdfUrl,
    },
  }
}

// --- Update fields ---

export async function updateInboundPO(
  id: string,
  fields: {
    customer_po_number?: string | null
    customer_name?: string | null
    contact_name?: string | null
    po_date?: string | null
    total_value?: number | null
    delivery_address?: string | null
    special_instructions?: string | null
    our_reference?: string | null
    internal_notes?: string | null
  }
) {
  const user = await requirePermission('inbound_pos', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('inbound_purchase_orders')
    .update({
      ...fields,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'inbound_po',
    entityId: id,
    action: 'edited',
    details: { fields_changed: Object.keys(fields) },
  })

  revalidatePath(`/inbound-pos/${id}`)
  return { success: true }
}

// --- Manual match ---

export async function manualMatchQuote(id: string, quoteId: string) {
  const user = await requirePermission('inbound_pos', 'edit')
  const supabase = await createClient()

  // Get the quote to verify and get customer_id
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, customer_id, quote_number')
    .eq('id', quoteId)
    .single()

  if (!quote) return { error: 'Quote not found' }

  // Get PO lines for line matching
  const { data: po } = await supabase
    .from('inbound_purchase_orders')
    .select('id, extracted_data')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!po) return { error: 'Inbound PO not found' }

  // Update the match
  const { error } = await supabase
    .from('inbound_purchase_orders')
    .update({
      matched_quote_id: quoteId,
      matched_company_id: quote.customer_id,
      match_confidence: 'exact',
      match_method: 'manual',
      status: 'matched',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Run line matching if we have extracted data
  const extractedData = po.extracted_data as { line_items?: { description: string | null; quantity: number | null; unit_price: number | null; line_total: number | null; product_code: string | null }[] } | null
  if (extractedData?.line_items && extractedData.line_items.length > 0) {
    const lineMatches = await matchLines(
      supabase,
      quoteId,
      extractedData.line_items.map((l, i) => ({
        line_number: i + 1,
        ...l,
      }))
    )

    const { data: poLines } = await supabase
      .from('inbound_po_lines')
      .select('id')
      .eq('inbound_po_id', id)
      .order('sort_order')

    if (poLines) {
      for (let i = 0; i < lineMatches.length && i < poLines.length; i++) {
        const lm = lineMatches[i]
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

  logActivity({
    supabase,
    user,
    entityType: 'inbound_po',
    entityId: id,
    action: 'matched',
    details: {
      quote_id: quoteId,
      quote_number: quote.quote_number,
      match_method: 'manual',
      match_confidence: 'exact',
    },
  })

  revalidatePath(`/inbound-pos/${id}`)
  revalidatePath('/inbound-pos')
  return { success: true }
}

// --- Unmatch ---

export async function unmatchQuote(id: string) {
  const user = await requirePermission('inbound_pos', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('inbound_purchase_orders')
    .update({
      matched_quote_id: null,
      match_confidence: null,
      match_method: null,
      status: 'pending_review',
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  // Clear line matches
  await supabase
    .from('inbound_po_lines')
    .update({
      matched_quote_line_id: null,
      line_match_confidence: null,
    })
    .eq('inbound_po_id', id)

  revalidatePath(`/inbound-pos/${id}`)
  revalidatePath('/inbound-pos')
  return { success: true }
}

// --- Reject ---

export async function rejectInboundPO(id: string, reason: string) {
  const user = await requirePermission('inbound_pos', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('inbound_purchase_orders')
    .update({
      status: 'rejected',
      reject_reason: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'inbound_po',
    entityId: id,
    action: 'rejected',
    details: { reason },
  })

  revalidatePath(`/inbound-pos/${id}`)
  revalidatePath('/inbound-pos')
  return { success: true }
}

// --- Search quotes for manual matching ---

export async function searchQuotesForMatch(query: string, orgId?: string) {
  const user = await requirePermission('inbound_pos', 'view')
  const supabase = await createClient()

  const effectiveOrgId = orgId || user.orgId
  const search = `%${query}%`

  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, status, customer_id, customers(name)')
    .eq('org_id', effectiveOrgId)
    .in('status', ['draft', 'review', 'sent', 'accepted'])
    .or(`quote_number.ilike.${search}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return { error: error.message }

  // Also search by customer name
  const { data: byCustomer } = await supabase
    .from('quotes')
    .select('id, quote_number, status, customer_id, customers(name)')
    .eq('org_id', effectiveOrgId)
    .in('status', ['draft', 'review', 'sent', 'accepted'])
    .limit(20)

  // Filter customer matches client-side (Supabase doesn't support nested ilike easily)
  const customerMatches = (byCustomer || []).filter((q) => {
    const customer = q.customers as unknown as { name: string } | null
    return customer?.name.toLowerCase().includes(query.toLowerCase())
  })

  // Merge and deduplicate
  const allResults = [...(data || []), ...customerMatches]
  const uniqueMap = new Map(allResults.map((r) => [r.id, r]))
  const results = Array.from(uniqueMap.values()).slice(0, 20)

  // Get totals for each quote
  const resultsWithTotals = await Promise.all(
    results.map(async (q) => {
      const { data: lines } = await supabase
        .from('quote_lines')
        .select('quantity, sell_price, is_optional')
        .eq('quote_id', q.id)
        .eq('is_optional', false)

      const total = (lines || []).reduce((sum, l) => sum + l.quantity * l.sell_price, 0)
      return { ...q, total }
    })
  )

  return { data: resultsWithTotals }
}

// --- Delete ---

export async function deleteInboundPO(id: string) {
  const user = await requirePermission('inbound_pos', 'delete')
  const supabase = await createClient()

  // Verify record belongs to this org
  const { data: po } = await supabase
    .from('inbound_purchase_orders')
    .select('id, pdf_storage_path, customer_po_number')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!po) return { error: 'Inbound PO not found' }

  // Delete lines first (FK constraint)
  await supabase.from('inbound_po_lines').delete().eq('inbound_po_id', id)

  // Delete the PDF from storage if it exists
  if (po.pdf_storage_path) {
    await supabase.storage.from('inbound-pos').remove([po.pdf_storage_path])
  }

  // Delete the record
  const { error } = await supabase
    .from('inbound_purchase_orders')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'inbound_po',
    entityId: id,
    action: 'deleted',
    details: { customer_po_number: po.customer_po_number },
  })

  revalidatePath('/inbound-pos')
  return { success: true }
}

// --- Pending count for sidebar badge ---

export async function getPendingCount() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('inbound_purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
    .in('status', ['pending_review', 'matched'])

  if (error) return 0
  return count || 0
}

// --- Retry extraction ---

export async function retryExtraction(id: string) {
  const user = await requirePermission('inbound_pos', 'edit')
  const supabase = await createClient()

  // Get the record with storage path
  const { data: po } = await supabase
    .from('inbound_purchase_orders')
    .select('id, pdf_storage_path, org_id')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!po) return { error: 'Inbound PO not found' }
  if (!po.pdf_storage_path) return { error: 'No PDF file associated with this record' }

  // Download the PDF
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('inbound-pos')
    .download(po.pdf_storage_path)

  if (downloadError || !fileData) {
    return { error: `Failed to download PDF: ${downloadError?.message || 'Unknown error'}` }
  }

  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  // Clear existing lines
  await supabase.from('inbound_po_lines').delete().eq('inbound_po_id', id)

  // Reset status
  await supabase
    .from('inbound_purchase_orders')
    .update({
      status: 'uploading',
      extraction_method: null,
      extraction_confidence: null,
      raw_extracted_text: null,
      extracted_data: null,
      error_message: null,
      matched_quote_id: null,
      matched_company_id: null,
      match_confidence: null,
      match_method: null,
    })
    .eq('id', id)

  // Get API key
  const { data: apiKeySetting } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'anthropic_api_key')
    .single()

  const apiKey = (apiKeySetting?.setting_value as string | null) || process.env.ANTHROPIC_API_KEY || null

  // Fire-and-forget: re-run pipeline (uses admin client internally)
  processInboundPO(id, pdfBuffer, user.orgId, apiKey, user)
    .catch((err) => console.error('[retry-extraction] Pipeline error:', err))

  revalidatePath(`/inbound-pos/${id}`)
  return { success: true }
}
