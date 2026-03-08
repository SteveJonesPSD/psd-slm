import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { decryptCustomerRow } from '@/lib/crypto-helpers'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { InvoicePdfDocument } from './invoice-pdf-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requirePermission('invoices', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      customers:customer_id(name, address_line1, address_line2, city, postcode),
      contacts(first_name, last_name),
      brands(name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, default_payment_terms_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number),
      invoice_lines(id, description, quantity, unit_price, vat_rate, sort_order, group_name, sales_order_line_id, product_id, products(product_type))
    `)
    .eq('id', id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const rawCustomer = invoice.customers as {
    name: string; address_line1: string | null; address_line2: string | null;
    city: string | null; postcode: string | null
  } | null
  const customer = rawCustomer ? decryptCustomerRow(rawCustomer) : null

  // Fetch delivery address from SO if it differs from billing
  let deliveryAddress = null
  if (invoice.sales_order_id) {
    const { data: so } = await supabase
      .from('sales_orders')
      .select('delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode')
      .eq('id', invoice.sales_order_id)
      .single()
    if (so && so.delivery_address_line1) {
      if (so.delivery_address_line1 !== customer?.address_line1 || so.delivery_postcode !== customer?.postcode) {
        deliveryAddress = so
      }
    }
  }

  const contact = invoice.contacts as { first_name: string; last_name: string } | null

  const brand = invoice.brands as {
    name: string; legal_entity: string | null; logo_path: string | null; logo_width: number;
    phone: string | null; fax: string | null; email: string | null; website: string | null;
    footer_text: string | null; default_payment_terms_text: string | null;
    address_line1: string | null; address_line2: string | null; city: string | null;
    county: string | null; postcode: string | null; company_reg_number: string | null; vat_number: string | null;
  } | null

  const rawLines = (invoice.invoice_lines || []) as {
    id: string; description: string; quantity: number; unit_price: number;
    vat_rate: number; sort_order: number; group_name: string | null;
    sales_order_line_id: string | null; product_id: string | null;
    products: { product_type: string } | null
  }[]

  // Fetch serial numbers from SO lines for serialised products
  const soLineIds = rawLines.map((l) => l.sales_order_line_id).filter(Boolean) as string[]
  let serialMap = new Map<string, string[]>()
  if (soLineIds.length > 0) {
    const { data: soLines } = await supabase
      .from('sales_order_lines')
      .select('id, serial_numbers_received')
      .in('id', soLineIds)
    if (soLines) {
      for (const sl of soLines) {
        if (sl.serial_numbers_received && sl.serial_numbers_received.length > 0) {
          serialMap.set(sl.id, sl.serial_numbers_received)
        }
      }
    }
  }

  const lines = rawLines.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    vat_rate: l.vat_rate,
    sort_order: l.sort_order,
    group_name: l.group_name,
    serial_numbers: l.sales_order_line_id ? serialMap.get(l.sales_order_line_id) || null : null,
    is_hidden_service: l.products?.product_type === 'service' && l.unit_price === 0,
  }))

  try {
    const element = React.createElement(InvoicePdfDocument, {
      invoice: {
        invoice_number: invoice.invoice_number,
        invoice_type: invoice.invoice_type,
        status: invoice.status,
        vat_rate: invoice.vat_rate || 20,
        due_date: invoice.due_date,
        customer_po: invoice.customer_po,
        payment_terms: invoice.payment_terms,
        created_at: invoice.created_at,
        sent_at: invoice.sent_at,
      },
      customer,
      contact,
      brand,
      lines,
      deliveryAddress,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[invoice-pdf-generation]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
