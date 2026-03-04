import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import React from 'react'
import { CollectionSlipPdf } from './collection-slip-pdf'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let user
  try {
    user = await requirePermission('collections', 'view')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: collection, error } = await supabase
    .from('job_collections')
    .select(`
      *,
      jobs(id, job_number, title, assigned_to,
        assigned_user:users!jobs_assigned_to_fkey(first_name, last_name)
      ),
      sales_orders(id, so_number, customer_id, customers(id, name))
    `)
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
  }

  const { data: lines } = await supabase
    .from('job_collection_lines')
    .select('id, description, quantity_expected, expected_serials')
    .eq('collection_id', id)
    .order('sort_order', { ascending: true })

  // Get brand
  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('org_id', user.orgId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  const job = collection.jobs as unknown as { job_number: string; assigned_user: { first_name: string; last_name: string } | null } | null
  const so = collection.sales_orders as unknown as { customers: { name: string } | null } | null
  const customerName = so?.customers?.name || 'Unknown Customer'
  const jobNumber = job?.job_number || 'N/A'
  const engineerName = job?.assigned_user
    ? `${job.assigned_user.first_name} ${job.assigned_user.last_name}`
    : 'Unassigned'

  const domain = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'localhost:3000'
  const protocol = domain.includes('localhost') ? 'http' : 'https'
  const magicLinkUrl = `${protocol}://${domain}/collect/${collection.slip_token}`

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(magicLinkUrl, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M',
  })

  const formattedDate = new Date(collection.prepared_at || collection.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const pdfLines = (lines || []).map((l) => ({
    id: l.id,
    description: l.description,
    quantity_expected: l.quantity_expected,
    expected_serials: l.expected_serials as string[] | null,
  }))

  try {
    const element = React.createElement(CollectionSlipPdf, {
      slipNumber: collection.slip_number,
      customerName,
      jobNumber,
      engineerName,
      date: formattedDate,
      itemCount: pdfLines.length,
      notes: collection.notes,
      lines: pdfLines,
      qrDataUrl,
      magicLinkUrl,
      brandName: brand?.name || 'PSD Group',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${collection.slip_number}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[collection-slip-pdf]', pdfError)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
