import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifications } from '@/lib/notifications'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const formData = await request.formData()
  const token = formData.get('token') as string
  const poNumber = formData.get('po_number') as string
  const poFile = formData.get('po_file') as File | null

  if (!token || !poNumber) {
    return NextResponse.json({ error: 'Token and PO number are required' }, { status: 400 })
  }

  // Validate token matches quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, org_id, portal_token, status, quote_number, customer_id, assigned_to')
    .eq('id', id)
    .eq('portal_token', token)
    .single()

  if (!quote) {
    return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 })
  }

  if (quote.status !== 'sent') {
    return NextResponse.json({ error: 'Quote is not in a state that can be accepted' }, { status: 400 })
  }

  // Handle optional PO file upload
  let poDocumentPath: string | null = null
  if (poFile && poFile.size > 0) {
    const ext = poFile.name.split('.').pop() || 'pdf'
    const storagePath = `${id}/po-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('po-documents')
      .upload(storagePath, poFile)

    if (!uploadError) {
      poDocumentPath = storagePath
    }
  }

  // Update quote
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'accepted',
      customer_po: poNumber,
      accepted_at: new Date().toISOString(),
      po_document_path: poDocumentPath,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify attributed users and assigned user
  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', quote.customer_id)
    .single()

  const { data: attributions } = await supabase
    .from('quote_attributions')
    .select('user_id')
    .eq('quote_id', id)

  const userIds = new Set<string>()
  if (quote.assigned_to) userIds.add(quote.assigned_to)
  if (attributions) {
    for (const a of attributions) userIds.add(a.user_id)
  }

  const customerName = customer?.name || 'Customer'
  const notifications = Array.from(userIds).map((userId) => ({
    supabase,
    orgId: quote.org_id,
    userId,
    type: 'quote_accepted',
    title: 'Quote Accepted',
    message: `${quote.quote_number} has been accepted by ${customerName}. PO: ${poNumber}`,
    link: `/quotes/${id}`,
    entityType: 'quote',
    entityId: id,
  }))

  createNotifications(notifications)

  return NextResponse.json({ success: true })
}
