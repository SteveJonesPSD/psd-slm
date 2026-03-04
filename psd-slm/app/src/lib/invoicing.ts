import type { SupabaseClient } from '@supabase/supabase-js'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'credit_note'
export type InvoiceType = 'standard' | 'proforma' | 'credit_note'

/**
 * Generate the next invoice number using the brand's invoice_prefix.
 * Format: {prefix}-{YYYY}-{NNNN}
 * Falls back to 'INV' if no brand or prefix found.
 */
export async function generateInvoiceNumber(
  supabase: SupabaseClient,
  orgId: string,
  prefix: string = 'INV',
): Promise<string> {
  const year = new Date().getFullYear()
  const fullPrefix = `${prefix}-${year}-`

  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('org_id', orgId)
    .like('invoice_number', `${fullPrefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].invoice_number
    // Extract the numeric sequence from the end (handle CN suffixes)
    const parts = last.split('-')
    // Find the last numeric part
    for (let i = parts.length - 1; i >= 0; i--) {
      const num = parseInt(parts[i], 10)
      if (!isNaN(num) && parts[i].length === 4) {
        seq = num + 1
        break
      }
    }
  }

  return `${fullPrefix}${String(seq).padStart(4, '0')}`
}

/**
 * Calculate invoice totals from lines.
 */
export function calculateInvoiceTotals(
  lines: { quantity: number; unit_price: number; vat_rate: number }[],
): { subtotal: number; vat_amount: number; total: number } {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const avgVatRate = lines.length > 0 ? lines[0].vat_rate : 20
  const vat_amount = subtotal * (avgVatRate / 100)
  const total = subtotal + vat_amount
  return { subtotal, vat_amount, total }
}

/**
 * Determine the effective display status of an invoice.
 * If a 'sent' invoice has a past due date, show it as 'overdue'.
 */
export function getEffectiveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string | null,
): InvoiceStatus {
  if (status === 'sent' && dueDate) {
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (due < today) return 'overdue'
  }
  return status
}
