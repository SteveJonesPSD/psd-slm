'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveInvoiceStatus } from '@/lib/invoicing'
import type { PortalContext, PortalInvoice, PortalInvoiceLine } from './types'

const INVOICE_STATUS_MAP: Record<string, string> = {
  draft: 'Draft',
  sent: 'Awaiting Payment',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
  credit_note: 'Credit Note',
}

function mapPortalStatus(status: string): string {
  return INVOICE_STATUS_MAP[status] || status
}

export async function getPortalInvoices(ctx: PortalContext): Promise<PortalInvoice[]> {
  const supabase = createAdminClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_type, status, subtotal, vat_amount, total,
      due_date, created_at, sent_at, paid_at, customer_po,
      sales_orders(id, so_number)
    `)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  return (invoices || []).map((inv) => {
    const so = inv.sales_orders as unknown as { id: string; so_number: string } | null
    const effectiveStatus = getEffectiveInvoiceStatus(
      inv.status as Parameters<typeof getEffectiveInvoiceStatus>[0],
      inv.due_date
    )

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceType: inv.invoice_type,
      createdAt: inv.created_at,
      sentAt: inv.sent_at,
      dueDate: inv.due_date,
      status: effectiveStatus,
      portalStatus: mapPortalStatus(effectiveStatus),
      subtotal: inv.subtotal,
      vatAmount: inv.vat_amount,
      total: inv.total,
      customerPo: inv.customer_po,
      soNumber: so?.so_number || null,
      soId: so?.id || null,
      paidAt: inv.paid_at,
    }
  })
}

export async function getPortalInvoiceDetail(
  invoiceId: string,
  ctx: PortalContext
): Promise<(PortalInvoice & { lines: PortalInvoiceLine[]; paymentTerms: string | null; notes: string | null }) | null> {
  const supabase = createAdminClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_type, status, subtotal, vat_amount, total,
      due_date, created_at, sent_at, paid_at, customer_po, payment_terms, notes,
      sales_orders(id, so_number),
      invoice_lines(id, description, quantity, unit_price, vat_rate, sort_order, group_name)
    `)
    .eq('id', invoiceId)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!inv) return null

  const so = inv.sales_orders as unknown as { id: string; so_number: string } | null
  const effectiveStatus = getEffectiveInvoiceStatus(
    inv.status as Parameters<typeof getEffectiveInvoiceStatus>[0],
    inv.due_date
  )

  const rawLines = (inv.invoice_lines || []) as unknown as {
    id: string; description: string; quantity: number; unit_price: number;
    vat_rate: number; sort_order: number; group_name: string | null
  }[]

  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    invoiceType: inv.invoice_type,
    createdAt: inv.created_at,
    sentAt: inv.sent_at,
    dueDate: inv.due_date,
    status: effectiveStatus,
    portalStatus: mapPortalStatus(effectiveStatus),
    subtotal: inv.subtotal,
    vatAmount: inv.vat_amount,
    total: inv.total,
    customerPo: inv.customer_po,
    soNumber: so?.so_number || null,
    soId: so?.id || null,
    paidAt: inv.paid_at,
    paymentTerms: inv.payment_terms ? `${inv.payment_terms} days` : null,
    notes: inv.notes,
    lines: rawLines
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        vatRate: l.vat_rate,
        groupName: l.group_name,
      })),
  }
}
