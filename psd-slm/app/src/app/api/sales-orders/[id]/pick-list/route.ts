import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { PickListDocument } from './pick-list-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requirePermission('sales_orders', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Fetch SO header
  const { data: so, error: soError } = await supabase
    .from('sales_orders')
    .select('so_number, customers(name)')
    .eq('id', id)
    .single()

  if (soError || !so) {
    return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
  }

  // Fetch allocations with status 'allocated' (items ready to pick)
  const { data: allocations, error: allocError } = await supabase
    .from('stock_allocations')
    .select(`
      id,
      quantity_allocated,
      serial_numbers,
      sales_order_lines!inner(id, description, products(sku)),
      stock_locations(name)
    `)
    .eq('sales_order_lines.sales_order_id', id)
    .eq('status', 'allocated')

  if (allocError) {
    console.error('[pick-list]', allocError.message)
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 })
  }

  if (!allocations || allocations.length === 0) {
    return NextResponse.json({ error: 'No allocated items to pick' }, { status: 404 })
  }

  const customerName = ((so.customers as unknown) as { name: string } | null)?.name || null

  const lines = allocations.map((a: Record<string, unknown>) => ({
    id: a.id as string,
    description: ((a.sales_order_lines as Record<string, unknown> | null)?.description as string) || '',
    sku: (((a.sales_order_lines as Record<string, unknown> | null)?.products as { sku: string } | null) as unknown as { sku: string } | null)?.sku || null,
    quantity: a.quantity_allocated as number,
    location: ((a.stock_locations as unknown as { name: string } | null))?.name || 'MAIN',
    serialNumbers: (a.serial_numbers as string[]) || [],
  }))

  try {
    const element = React.createElement(PickListDocument, {
      soNumber: so.so_number,
      customerName,
      date: new Date().toISOString(),
      lines,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${so.so_number}-pick-list.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[pick-list-pdf]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
