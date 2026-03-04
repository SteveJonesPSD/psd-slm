import { createAdminClient } from '@/lib/supabase/admin'
import { PortalQuoteView } from './portal-quote-view'
import { PortalAccepted } from './portal-accepted'
import { PortalDeclined } from './portal-declined'
import { PortalExpired } from './portal-expired'
import { PortalSuperseded } from './portal-superseded'
import { PortalRevised } from './portal-revised'
import { PortalNotFound } from './portal-not-found'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  // Fetch quote by portal token — SELECT only customer-visible fields
  const { data: rawQuote } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      version,
      quote_type,
      valid_until,
      vat_rate,
      customer_notes,
      customer_po,
      portal_token,
      sent_at,
      accepted_at,
      signed_by_name,
      customer_id,
      brand_id,
      customers(name, address_line1, address_line2, city, postcode),
      contacts!quotes_contact_id_fkey(first_name, last_name, email),
      brands(name, logo_path, phone, email, website, footer_text),
      quote_groups(id, name, sort_order),
      quote_lines(
        id, group_id, sort_order, description, quantity, sell_price, is_optional, requires_contract, products(product_type)
      )
    `)
    .eq('portal_token', token)
    .single()

  if (!rawQuote) {
    return <PortalNotFound />
  }

  // Transform Supabase join results to proper types
  const quote = {
    ...rawQuote,
    customers: rawQuote.customers as unknown as { name: string; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null } | null,
    contacts: rawQuote.contacts as unknown as { first_name: string; last_name: string; email: string | null } | null,
    brands: rawQuote.brands as unknown as { name: string; logo_path: string | null; phone: string | null; email: string | null; website: string | null; footer_text: string | null } | null,
    quote_groups: (rawQuote.quote_groups || []) as { id: string; name: string; sort_order: number }[],
    quote_lines: ((rawQuote.quote_lines || []) as unknown as { id: string; group_id: string | null; sort_order: number; description: string; quantity: number; sell_price: number; is_optional: boolean; requires_contract: boolean; products: { product_type: string } | null }[])
      .filter((l) => !(l.products?.product_type === 'service' && l.sell_price === 0)),
  }

  // Route by status
  switch (quote.status) {
    case 'sent':
      return <PortalQuoteView quote={quote} token={token} />

    case 'accepted':
      return <PortalAccepted quote={quote} />

    case 'declined':
      return <PortalDeclined quote={quote} />

    case 'expired':
      return <PortalExpired quote={quote} />

    case 'superseded':
      return <PortalSuperseded quote={quote} />

    case 'revised':
      return <PortalRevised quote={quote} />

    default:
      // Draft, review, etc. — not accessible via portal
      return <PortalNotFound />
  }
}
