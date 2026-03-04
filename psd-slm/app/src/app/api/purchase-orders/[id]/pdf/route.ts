import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { PoPdfDocument } from './po-pdf-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let user
  try {
    user = await requirePermission('purchase_orders', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  const [
    { data: supplier },
    { data: salesOrder },
    { data: lines },
    { data: brand },
  ] = await Promise.all([
    supabase.from('suppliers').select('name').eq('id', po.supplier_id).single(),
    po.sales_order_id
      ? supabase.from('sales_orders').select('so_number').eq('id', po.sales_order_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('purchase_order_lines')
      .select('id, description, quantity, unit_cost, products(sku)')
      .eq('purchase_order_id', id)
      .neq('status', 'cancelled')
      .order('sort_order', { ascending: true }),
    supabase
      .from('brands')
      .select('name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const pdfLines = (lines || []).map((l: { id: string; description: string; quantity: number; unit_cost: number; products: { sku: string } | null }) => ({
    id: l.id,
    description: l.description,
    quantity: l.quantity,
    unit_cost: l.unit_cost,
    sku: (l.products as { sku: string } | null)?.sku || null,
  }))

  try {
    const element = React.createElement(PoPdfDocument, {
      po: {
        po_number: po.po_number,
        created_at: po.created_at,
        sent_at: po.sent_at,
        delivery_cost: po.delivery_cost,
        notes: po.notes,
        delivery_destination: po.delivery_destination,
        delivery_address_line1: po.delivery_address_line1,
        delivery_address_line2: po.delivery_address_line2,
        delivery_city: po.delivery_city,
        delivery_postcode: po.delivery_postcode,
      },
      supplier: supplier || null,
      soNumber: (salesOrder as { so_number: string } | null)?.so_number || null,
      lines: pdfLines,
      brand: brand || null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${po.po_number}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[po-pdf-generation]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
