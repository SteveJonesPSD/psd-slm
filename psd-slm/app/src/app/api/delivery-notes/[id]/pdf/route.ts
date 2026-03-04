import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { DnPdfDocument } from './dn-pdf-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let user
  try {
    user = await requirePermission('delivery_notes', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: dn, error } = await supabase
    .from('delivery_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !dn) {
    return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 })
  }

  const [
    { data: salesOrder },
    { data: lines },
    { data: brand },
  ] = await Promise.all([
    supabase.from('sales_orders').select('so_number, customers(name)').eq('id', dn.sales_order_id).single(),
    supabase
      .from('delivery_note_lines')
      .select('id, description, quantity, serial_numbers, products(sku)')
      .eq('delivery_note_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('brands')
      .select('name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const soNumber = (salesOrder as { so_number: string } | null)?.so_number || null
  const customerName = ((salesOrder as { customers: { name: string } | null } | null)?.customers as { name: string } | null)?.name || null

  const pdfLines = (lines || []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    description: l.description as string,
    quantity: l.quantity as number,
    sku: ((l.products as { sku: string } | null) as { sku: string } | null)?.sku || null,
    serialNumbers: (l.serial_numbers as string[]) || [],
  }))

  try {
    const element = React.createElement(DnPdfDocument, {
      dn: {
        dn_number: dn.dn_number,
        created_at: dn.created_at,
        carrier: dn.carrier,
        tracking_reference: dn.tracking_reference,
        notes: dn.notes,
        delivery_address_line1: dn.delivery_address_line1,
        delivery_address_line2: dn.delivery_address_line2,
        delivery_city: dn.delivery_city,
        delivery_postcode: dn.delivery_postcode,
      },
      soNumber,
      customerName,
      lines: pdfLines,
      brand: brand || null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${dn.dn_number}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[dn-pdf-generation]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
