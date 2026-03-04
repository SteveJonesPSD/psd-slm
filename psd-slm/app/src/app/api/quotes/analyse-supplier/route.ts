import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromPDF } from '@/lib/inbound-po/extract'
import { extractSupplierQuoteData, extractSupplierQuoteFromEmail, extractSupplierQuoteFromScreenshot } from '@/lib/supplier-quote/ai-extract'
import { extractTextFromEml } from '@/lib/supplier-quote/email-extract'
import { matchProducts, matchSupplier } from '@/lib/supplier-quote/match'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const user = await requirePermission('quotes', 'create')
    const supabase = await createClient()

    // Get API key for AI processing
    const { data: apiKeySetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', user.orgId)
      .eq('setting_key', 'anthropic_api_key')
      .single()

    const apiKey = (apiKeySetting?.setting_value as string | null) || process.env.ANTHROPIC_API_KEY || null

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No Anthropic API key configured. Go to Settings > API Keys to add one.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const emailText = formData.get('email_text') as string | null
    const screenshot = formData.get('screenshot') as string | null
    const screenshotType = formData.get('screenshot_type') as string | null

    // Determine input type and process accordingly
    if (screenshot && screenshotType) {
      // --- Screenshot mode ---
      return await handleScreenshot(supabase, user, apiKey, screenshot, screenshotType)
    } else if (emailText) {
      // --- Pasted email text mode ---
      return await handleEmailText(supabase, user, apiKey, emailText)
    } else if (file) {
      const isEml = file.name.toLowerCase().endsWith('.eml') || file.type === 'message/rfc822'
      if (isEml) {
        // --- .eml file mode ---
        return await handleEmlFile(supabase, user, apiKey, file)
      } else if (file.type === 'application/pdf') {
        // --- PDF file mode (existing) ---
        return await handlePdfFile(supabase, user, apiKey, file)
      } else {
        return NextResponse.json({ error: 'Only PDF and .eml files are accepted.' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'No input provided. Upload a file, paste email text, or provide a screenshot.' }, { status: 400 })
    }
  } catch (err) {
    console.error('[analyse-supplier] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// --- PDF handler (existing flow, extracted into function) ---

async function handlePdfFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; orgId: string },
  apiKey: string,
  file: File
) {
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
  }

  // Upload PDF to storage for later attachment
  const pdfBuffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${user.orgId}/supplier-imports/${crypto.randomUUID()}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('quote-attachments')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('[analyse-supplier] Storage upload failed:', uploadError.message)
  }

  // Extract text from PDF
  console.log('[analyse-supplier] Extracting text from PDF...')
  const extraction = await extractTextFromPDF(pdfBuffer, apiKey)

  if (!extraction.rawText || extraction.rawText.trim().length === 0) {
    return NextResponse.json(
      { error: 'Could not extract text from this PDF. The file may be empty or corrupted.' },
      { status: 400 }
    )
  }

  // AI structured extraction
  console.log('[analyse-supplier] Running AI extraction...')
  const { data: extracted, confidence } = await extractSupplierQuoteData(extraction.rawText, apiKey)

  if (confidence === 'failed') {
    return NextResponse.json(
      { error: 'AI extraction failed. Please try again or enter the quote details manually.' },
      { status: 500 }
    )
  }

  // Match supplier
  let supplierMatch = null
  if (extracted.supplier_name) {
    supplierMatch = await matchSupplier(supabase, user.orgId, extracted.supplier_name, extracted.sender_email)
  }

  // Match products
  const productMatches = await matchProducts(
    supabase,
    user.orgId,
    extracted.line_items,
    supplierMatch?.matched_supplier_id || null
  )

  const lookups = await fetchLookups(supabase, user.orgId)

  return NextResponse.json({
    extracted,
    confidence,
    extraction_method: extraction.method,
    input_type: 'pdf',
    supplier_match: supplierMatch,
    product_matches: productMatches,
    pdf_storage_path: uploadError ? null : storagePath,
    pdf_file_name: file.name,
    lookups,
    current_user_id: user.id,
  })
}

// --- .eml file handler ---

async function handleEmlFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; orgId: string },
  apiKey: string,
  file: File
) {
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload .eml to storage for later attachment
  const storagePath = `${user.orgId}/supplier-imports/${crypto.randomUUID()}/${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('quote-attachments')
    .upload(storagePath, buffer, {
      contentType: 'message/rfc822',
      upsert: false,
    })

  if (uploadError) {
    console.error('[analyse-supplier] EML storage upload failed:', uploadError.message)
  }

  // Parse .eml
  console.log('[analyse-supplier] Parsing .eml file...')
  const parsed = await extractTextFromEml(buffer)

  if (!parsed.bodyText || parsed.bodyText.trim().length === 0) {
    return NextResponse.json(
      { error: 'Could not extract text from this email file. The file may be empty.' },
      { status: 400 }
    )
  }

  // AI extraction with email-specific prompt
  console.log('[analyse-supplier] Running AI email extraction...')
  const { data: extracted, confidence } = await extractSupplierQuoteFromEmail(
    parsed.bodyText,
    apiKey,
    parsed.senderEmail,
    parsed.senderName
  )

  if (confidence === 'failed') {
    return NextResponse.json(
      { error: 'AI extraction failed. Please try again or paste the email content instead.' },
      { status: 500 }
    )
  }

  // Match supplier using name + sender email domain
  const senderEmail = extracted.sender_email || parsed.senderEmail
  let supplierMatch = null
  if (extracted.supplier_name) {
    supplierMatch = await matchSupplier(supabase, user.orgId, extracted.supplier_name, senderEmail)
  }

  const productMatches = await matchProducts(
    supabase,
    user.orgId,
    extracted.line_items,
    supplierMatch?.matched_supplier_id || null
  )

  const lookups = await fetchLookups(supabase, user.orgId)

  return NextResponse.json({
    extracted,
    confidence,
    extraction_method: 'eml_parse',
    input_type: 'eml',
    supplier_match: supplierMatch,
    product_matches: productMatches,
    pdf_storage_path: uploadError ? null : storagePath,
    pdf_file_name: file.name,
    lookups,
    current_user_id: user.id,
  })
}

// --- Pasted email text handler ---

async function handleEmailText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; orgId: string },
  apiKey: string,
  emailText: string
) {
  if (emailText.trim().length < 50) {
    return NextResponse.json(
      { error: 'Email text too short. Please paste the full email content.' },
      { status: 400 }
    )
  }

  console.log('[analyse-supplier] Running AI email text extraction...')
  const { data: extracted, confidence } = await extractSupplierQuoteFromEmail(emailText, apiKey)

  if (confidence === 'failed') {
    return NextResponse.json(
      { error: 'AI extraction failed. Please try again or check the email content.' },
      { status: 500 }
    )
  }

  let supplierMatch = null
  if (extracted.supplier_name) {
    supplierMatch = await matchSupplier(supabase, user.orgId, extracted.supplier_name, extracted.sender_email)
  }

  const productMatches = await matchProducts(
    supabase,
    user.orgId,
    extracted.line_items,
    supplierMatch?.matched_supplier_id || null
  )

  const lookups = await fetchLookups(supabase, user.orgId)

  return NextResponse.json({
    extracted,
    confidence,
    extraction_method: 'email_text',
    input_type: 'email_text',
    supplier_match: supplierMatch,
    product_matches: productMatches,
    pdf_storage_path: null,
    pdf_file_name: null,
    lookups,
    current_user_id: user.id,
  })
}

// --- Screenshot handler ---

async function handleScreenshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; orgId: string },
  apiKey: string,
  base64: string,
  mimeType: string
) {
  console.log('[analyse-supplier] Running AI screenshot extraction...')
  const { data: extracted, confidence } = await extractSupplierQuoteFromScreenshot(base64, mimeType, apiKey)

  if (confidence === 'failed') {
    return NextResponse.json(
      { error: 'AI extraction failed. The image may be unclear. Try pasting the email text instead.' },
      { status: 500 }
    )
  }

  let supplierMatch = null
  if (extracted.supplier_name) {
    supplierMatch = await matchSupplier(supabase, user.orgId, extracted.supplier_name, extracted.sender_email)
  }

  const productMatches = await matchProducts(
    supabase,
    user.orgId,
    extracted.line_items,
    supplierMatch?.matched_supplier_id || null
  )

  const lookups = await fetchLookups(supabase, user.orgId)

  return NextResponse.json({
    extracted,
    confidence,
    extraction_method: 'screenshot_ocr',
    input_type: 'screenshot',
    supplier_match: supplierMatch,
    product_matches: productMatches,
    pdf_storage_path: null,
    pdf_file_name: null,
    lookups,
    current_user_id: user.id,
  })
}

// --- Shared lookup fetch ---

async function fetchLookups(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const [
    { data: customers },
    { data: contacts },
    { data: suppliers },
    { data: users },
    { data: brands },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, customer_type').eq('org_id', orgId).eq('is_active', true).order('name'),
    supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
    supabase.from('suppliers').select('id, name').eq('org_id', orgId).eq('is_active', true).order('name'),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', orgId).eq('is_active', true),
    supabase.from('brands').select('id, name, customer_type').eq('org_id', orgId),
  ])

  return {
    customers: customers || [],
    contacts: contacts || [],
    suppliers: suppliers || [],
    users: users || [],
    brands: brands || [],
  }
}
