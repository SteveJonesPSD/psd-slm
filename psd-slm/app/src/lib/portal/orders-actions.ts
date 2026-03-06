'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext, PortalOrder, PortalOrderLine } from './types'

const SO_STATUS_MAP: Record<string, string> = {
  draft: 'Processing',
  confirmed: 'Confirmed',
  picking: 'Being Prepared',
  partially_delivered: 'Partially Delivered',
  delivered: 'Delivered',
  invoiced: 'Complete',
}

function mapPortalStatus(status: string): string {
  return SO_STATUS_MAP[status] || status
}

export async function getPortalOrders(ctx: PortalContext): Promise<PortalOrder[]> {
  const supabase = createAdminClient()

  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      id, so_number, created_at, status, notes,
      sales_order_lines(quantity, sell_price),
      quotes(id, quote_number)
    `)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })

  return (orders || []).map((o) => {
    const lines = (o.sales_order_lines || []) as unknown as { quantity: number; sell_price: number }[]
    const totalSell = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
    const quote = o.quotes as unknown as { id: string; quote_number: string } | null

    return {
      id: o.id,
      soNumber: o.so_number,
      createdAt: o.created_at,
      status: o.status,
      portalStatus: mapPortalStatus(o.status),
      notes: o.notes,
      totalSell,
      quoteNumber: quote?.quote_number || null,
      quoteId: quote?.id || null,
    }
  })
}

export async function getPortalOrderDetail(
  orderId: string,
  ctx: PortalContext
): Promise<(PortalOrder & { lines: PortalOrderLine[]; deliveryAddress: string | null }) | null> {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select(`
      id, so_number, created_at, status, notes, delivery_address,
      sales_order_lines(id, description, quantity, sell_price, status),
      quotes(id, quote_number)
    `)
    .eq('id', orderId)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!order) return null

  const rawLines = (order.sales_order_lines || []) as unknown as {
    id: string; description: string; quantity: number; sell_price: number; status: string
  }[]
  const quote = order.quotes as unknown as { id: string; quote_number: string } | null
  const totalSell = rawLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)

  return {
    id: order.id,
    soNumber: order.so_number,
    createdAt: order.created_at,
    status: order.status,
    portalStatus: mapPortalStatus(order.status),
    notes: order.notes,
    totalSell,
    quoteNumber: quote?.quote_number || null,
    quoteId: quote?.id || null,
    deliveryAddress: order.delivery_address || null,
    lines: rawLines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      sellPrice: l.sell_price,
      status: mapPortalStatus(l.status),
    })),
  }
}
