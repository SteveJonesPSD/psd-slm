import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { decryptContactRow } from '@/lib/crypto-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: customerId } = await params
  const type = request.nextUrl.searchParams.get('type')
  const entityId = request.nextUrl.searchParams.get('entityId')

  if (!type || !entityId) {
    return NextResponse.json({ error: 'Missing type or entityId' }, { status: 400 })
  }

  const supabase = await createClient()
  const orgId = user.orgId

  try {
    switch (type) {
      case 'Sales Order': {
        const { data: so } = await supabase
          .from('sales_orders')
          .select('id, so_number, status, customer_po, created_at, notes')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!so) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: lines } = await supabase
          .from('sales_order_lines')
          .select('id, description, quantity, sell_price, buy_price, status, fulfilment_route')
          .eq('sales_order_id', entityId)
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          detail: {
            ...so,
            lines: lines || [],
          },
        })
      }

      case 'Ticket': {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('id, ticket_number, subject, status, priority, created_at, assignee:assigned_to(first_name, last_name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: messages } = await supabase
          .from('ticket_messages')
          .select('id, body, sender_type, is_internal, created_at, sender:sender_id(first_name, last_name)')
          .eq('ticket_id', entityId)
          .order('created_at', { ascending: true })
          .limit(10)

        return NextResponse.json({
          detail: {
            ...ticket,
            messages: messages || [],
          },
        })
      }

      case 'Quote': {
        const { data: quote } = await supabase
          .from('quotes')
          .select('id, quote_number, title, status, created_at, valid_until, customer_po, quote_type')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: lines } = await supabase
          .from('quote_lines')
          .select('id, description, quantity, sell_price, buy_price, is_optional')
          .eq('quote_id', entityId)
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          detail: {
            ...quote,
            lines: lines || [],
          },
        })
      }

      case 'Invoice': {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id, invoice_number, status, total, invoice_type, due_date, paid_at, created_at')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: lines } = await supabase
          .from('invoice_lines')
          .select('id, description, quantity, unit_price, unit_cost, products(name, sku)')
          .eq('invoice_id', entityId)
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          detail: {
            ...invoice,
            lines: lines || [],
          },
        })
      }

      case 'Job': {
        const { data: job } = await supabase
          .from('jobs')
          .select('id, job_number, title, status, priority, scheduled_date, scheduled_time, estimated_duration_minutes, notes, engineer:assigned_to(first_name, last_name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: tasks } = await supabase
          .from('job_tasks')
          .select('id, description, response_type, response_value, is_required, is_completed')
          .eq('job_id', entityId)
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          detail: {
            ...job,
            tasks: tasks || [],
          },
        })
      }

      case 'Purchase Order': {
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('id, po_number, status, supplier_ref, created_at, suppliers(name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: lines } = await supabase
          .from('purchase_order_lines')
          .select('id, description, quantity, unit_cost, status, quantity_received')
          .eq('purchase_order_id', entityId)
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          detail: {
            ...po,
            lines: lines || [],
          },
        })
      }

      case 'Contact': {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, mobile, job_title, is_primary, is_billing, is_shipping, is_portal_user, is_portal_admin, is_technical, is_overseer')
          .eq('id', entityId)
          .single()
        if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ detail: decryptContactRow(contact) })
      }

      case 'Opportunity': {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('id, title, stage, estimated_value, probability, expected_close_date, description, owner:owner_id(first_name, last_name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ detail: opp })
      }

      case 'Contract': {
        const { data: contract } = await supabase
          .from('customer_contracts')
          .select('id, contract_number, status, start_date, end_date, annual_value, auto_renew, billing_frequency, contract_types(name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ detail: contract })
      }

      case 'Deal Reg': {
        const { data: dr } = await supabase
          .from('deal_registrations')
          .select('id, reference, title, status, registered_date, expiry_date, suppliers(name)')
          .eq('id', entityId)
          .eq('org_id', orgId)
          .single()
        if (!dr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: lines } = await supabase
          .from('deal_registration_lines')
          .select('id, products(name, sku), registered_buy_price, max_quantity')
          .eq('deal_reg_id', entityId)
          .limit(20)

        return NextResponse.json({
          detail: {
            ...dr,
            lines: lines || [],
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (err) {
    console.error('[customer-search-detail]', err)
    return NextResponse.json({ error: 'Failed to load detail' }, { status: 500 })
  }
}
