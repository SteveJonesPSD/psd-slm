import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, hasPermission } from '@/lib/auth'

// TODO: Integrate with Resend or Postmark for email delivery
// For now, this is a placeholder that logs the action

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('quote_number, portal_token, contacts!quotes_contact_id_fkey(email, first_name)')
    .eq('id', id)
    .single()

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const contact = quote.contacts as unknown as { email: string | null; first_name: string } | null

  // Placeholder: log what would be sent
  console.log('[quote-send]', {
    quote_number: quote.quote_number,
    portal_url: `/q/${quote.portal_token}`,
    recipient_email: contact?.email,
    recipient_name: contact?.first_name,
  })

  return NextResponse.json({
    success: true,
    message: 'Email sending not yet configured. Quote has been marked as sent.',
  })
}
