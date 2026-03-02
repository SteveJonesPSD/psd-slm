import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const body = await request.json()
  const { token, requested_by, request_type, message } = body

  if (!token || !requested_by || !message) {
    return NextResponse.json({ error: 'Token, name, and message are required' }, { status: 400 })
  }

  // Validate token matches quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, portal_token, status')
    .eq('id', id)
    .eq('portal_token', token)
    .single()

  if (!quote) {
    return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 })
  }

  if (quote.status !== 'sent') {
    return NextResponse.json({ error: 'Quote is not in a state that accepts change requests' }, { status: 400 })
  }

  // Insert change request
  const { error: insertError } = await supabase
    .from('quote_change_requests')
    .insert({
      quote_id: id,
      requested_by,
      request_type: request_type || 'general',
      message,
      status: 'pending',
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Set quote to review status
  await supabase
    .from('quotes')
    .update({ status: 'review' })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
