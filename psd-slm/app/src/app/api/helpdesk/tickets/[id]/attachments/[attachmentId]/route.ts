import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params
  const user = await requirePermission('helpdesk', 'view')
  const supabase = await createClient()

  // Verify ticket belongs to user's org
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
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
