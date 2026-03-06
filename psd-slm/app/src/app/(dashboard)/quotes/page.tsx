import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { getMarginThresholds } from '@/lib/margin-settings'
import { PageHeader } from '@/components/ui/page-header'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { QuotesTable } from './quotes-table'
import { QuotesPageActions } from './quotes-page-actions'
import { MobileQuoteList } from './mobile-quote-list'

export default async function QuotesPage() {
  const user = await requirePermission('quotes', 'view')
  const supabase = await createClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      *,
      customers(name),
      users!quotes_assigned_to_fkey(id, first_name, last_name, initials, color),
      quote_lines(quantity, sell_price, buy_price),
      opportunities(id, title)
    `)
    .order('created_at', { ascending: false })

  const quotesData = quotes || []
  const marginThresholds = await getMarginThresholds()
  const vp = user.viewPreferences

  return (
    <MobileDetector
      mobile={<MobileQuoteList quotes={quotesData} marginThresholds={marginThresholds} />}
      desktop={
        <div>
          <PageHeader
            title="All Quotes"
            subtitle={`${quotesData.length} quotes`}
            actions={<QuotesPageActions />}
          />
          <QuotesTable
            quotes={quotesData}
            marginThresholds={marginThresholds}
            defaultOwner={vp.quotes_owner}
            defaultStatus={vp.quotes_status}
          />
        </div>
      }
    />
  )
}
