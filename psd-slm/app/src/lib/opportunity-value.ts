import { createClient } from '@/lib/supabase/server'

/**
 * Recalculates an opportunity's estimated_value as the sum of non-optional
 * line totals from all active (non-revised/superseded) linked quotes.
 */
export async function recalcOpportunityValue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opportunityId: string | null
) {
  if (!opportunityId) return

  const { data: linkedQuotes } = await supabase
    .from('quotes')
    .select('id, quote_lines(quantity, sell_price, is_optional)')
    .eq('opportunity_id', opportunityId)
    .not('status', 'in', '("revised","superseded")')

  const total = (linkedQuotes || []).reduce((sum, q) => {
    const lines = (q.quote_lines as { quantity: number; sell_price: number; is_optional: boolean }[]) || []
    return sum + lines.filter(l => !l.is_optional).reduce((s, l) => s + l.quantity * l.sell_price, 0)
  }, 0)

  await supabase
    .from('opportunities')
    .update({ estimated_value: total || null })
    .eq('id', opportunityId)
}
