import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Validate token matches ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', id)
    .eq('portal_token', token)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Invalid ticket or token' }, { status: 404 })
  }

  // Fetch the attachment record
  const { data: attachment } = await supabase
    .from('ticket_attachments')
    .select('id, file_path, file_name')
    .eq('id', attachmentId)
    .eq('ticket_id', id)
    .single()

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  // Generate a signed URL (1 hour)
  const { data: signedUrl, error } = await supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(attachment.file_path, 3600)

  if (error || !signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(signedUrl.signedUrl)
}
