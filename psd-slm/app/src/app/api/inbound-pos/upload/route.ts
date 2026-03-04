import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-log'
import { processInboundPO } from '@/lib/inbound-po/pipeline'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const user = await requirePermission('inbound_pos', 'create')
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    // Create the inbound PO record first
    const { data: record, error: insertError } = await supabase
      .from('inbound_purchase_orders')
      .insert({
        org_id: user.orgId,
        source: 'upload',
        original_filename: file.name,
        status: 'uploading',
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Upload PDF to storage
    const storagePath = `${user.orgId}/${record.id}/${file.name}`
    const pdfBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('inbound-pos')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      // Clean up the record
      await supabase.from('inbound_purchase_orders').delete().eq('id', record.id)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Update record with storage path
    await supabase
      .from('inbound_purchase_orders')
      .update({ pdf_storage_path: storagePath })
      .eq('id', record.id)

    // Log upload activity
    logActivity({
      supabase,
      user,
      entityType: 'inbound_po',
      entityId: record.id,
      action: 'uploaded',
      details: { source: 'upload', filename: file.name },
    })

    // Get API key for AI processing — try org_settings first, fall back to env var
    const { data: apiKeySetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', user.orgId)
      .eq('setting_key', 'anthropic_api_key')
      .single()

    const apiKey = (apiKeySetting?.setting_value as string | null) || process.env.ANTHROPIC_API_KEY || null

    // Fire-and-forget: start processing pipeline (uses admin client internally)
    processInboundPO(record.id, pdfBuffer, user.orgId, apiKey, user)
      .catch((err) => console.error('[inbound-po-upload] Pipeline error:', err))

    return NextResponse.json({ data: record })
  } catch (err) {
    console.error('[inbound-po-upload]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
