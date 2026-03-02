import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { QuotePdfDocument } from './quote-pdf-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requirePermission('quotes', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      *,
      customers(name, address_line1, address_line2, city, postcode),
      contacts!quotes_contact_id_fkey(first_name, last_name),
      brands(name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, default_terms, default_payment_terms_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number),
      quote_groups(id, name, sort_order),
      quote_lines(id, group_id, sort_order, description, quantity, sell_price, is_optional, requires_contract)
    `)
    .eq('id', id)
    .single()

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const customer = quote.customers as { name: string; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null } | null
  const contact = quote.contacts as { first_name: string; last_name: string } | null
  const brand = quote.brands as {
    name: string; legal_entity: string | null; logo_path: string | null; logo_width: number;
    phone: string | null; fax: string | null; email: string | null; website: string | null;
    footer_text: string | null; default_terms: string | null; default_payment_terms_text: string | null;
    address_line1: string | null; address_line2: string | null; city: string | null;
    county: string | null; postcode: string | null; company_reg_number: string | null; vat_number: string | null;
  } | null
  const groups = (quote.quote_groups || []) as { id: string; name: string; sort_order: number }[]
  const lines = (quote.quote_lines || []) as {
    id: string; group_id: string | null; sort_order: number; description: string;
    quantity: number; sell_price: number; is_optional: boolean; requires_contract: boolean
  }[]

  try {
    const portalUrl = quote.portal_token
      ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/q/${quote.portal_token}`
      : null

    const element = React.createElement(QuotePdfDocument, {
      quote: {
        quote_number: quote.quote_number,
        version: quote.version,
        vat_rate: quote.vat_rate,
        valid_until: quote.valid_until,
        customer_notes: quote.customer_notes,
        sent_at: quote.sent_at,
        created_at: quote.created_at,
      },
      customer,
      contact,
      brand,
      groups,
      lines,
      portalUrl,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.quote_number}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[pdf-generation]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
