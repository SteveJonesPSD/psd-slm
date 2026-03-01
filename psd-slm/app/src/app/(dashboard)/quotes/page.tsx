import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { QuotesTable } from './quotes-table'

export default async function QuotesPage() {
  const supabase = await createClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      *,
      customers(name),
      users!quotes_assigned_to_fkey(id, first_name, last_name, initials, color),
      quote_lines(quantity, sell_price)
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="All Quotes"
        subtitle={`${quotes?.length || 0} quotes`}
      />
      <QuotesTable quotes={quotes || []} />
    </div>
  )
}
