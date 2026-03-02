import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const body = await request.json()
  const { token, reason } = body

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
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
    return NextResponse.json({ error: 'Quote is not in a state that can be declined' }, { status: 400 })
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'declined',
      decline_reason: reason || null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
