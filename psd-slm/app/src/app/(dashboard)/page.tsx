import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, STAGE_CONFIG } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch data
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: quotes } = await supabase
    .from('quotes')
    .select('*')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')

  // Visit scheduling stats
  let visitStats = { todayCount: 0, weekCount: 0, unconfirmedCount: 0, bankHolidayPending: 0 }
  try {
    const { getVisitStats } = await import('@/app/(dashboard)/visit-scheduling/actions')
    visitStats = await getVisitStats()
  } catch {
    // Visit scheduling module may not be deployed yet
  }

  // Contracts due for renewal (within 90 days)
  let contractsDueRenewal = 0
  let contractsDueUrgent = false
  try {
    const now = new Date()
    const in90Days = new Date()
    in90Days.setDate(in90Days.getDate() + 90)
    const in30Days = new Date()
    in30Days.setDate(in30Days.getDate() + 30)

    const { data: dueContracts } = await supabase
      .from('customer_contracts')
      .select('end_date')
      .eq('status', 'active')
      .lte('end_date', in90Days.toISOString().split('T')[0])

    contractsDueRenewal = dueContracts?.length || 0
    contractsDueUrgent = (dueContracts || []).some(
      (c: { end_date: string }) => new Date(c.end_date) <= in30Days
    )
  } catch {
    // Contracts module may not be deployed yet
  }

  // Pending collections
  let pendingCollections = 0
  let collectedToday = 0
  try {
    const { getCollectionStats } = await import('@/lib/collections/actions')
    const colStats = await getCollectionStats()
    pendingCollections = colStats.pending
    collectedToday = colStats.collectedToday
  } catch {
    // Collections module may not be deployed yet
  }

  // For quotes with status 'sent', get their line totals
  const sentQuoteIds = (quotes || []).filter((q: { status: string; id: string }) => q.status === 'sent').map((q: { id: string }) => q.id)
  let quoteLinesTotal = 0
  if (sentQuoteIds.length > 0) {
    const { data: quoteLines } = await supabase
      .from('quote_lines')
      .select('quote_id, quantity, sell_price')
      .in('quote_id', sentQuoteIds)

    quoteLinesTotal = (quoteLines || []).reduce(
      (sum: number, l: { sell_price: number; quantity: number }) => sum + l.sell_price * l.quantity,
      0
    )
    // Apply average VAT (20%) for display — individual quote VAT rates vary
    quoteLinesTotal *= 1.2
  }

  type Opp = { id: string; title: string; customer_id: string; stage: string; estimated_value: number | null; probability: number }
  const opps: Opp[] = opportunities || []
  const activeOpps = opps.filter((o) => !['lost', 'won'].includes(o.stage))
  const pipelineValue = opps
    .filter((o) => o.stage !== 'lost')
    .reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const weightedValue = activeOpps.reduce(
    (sum, o) => sum + ((o.estimated_value || 0) * o.probability) / 100,
    0
  )
  const quotesOut = sentQuoteIds.length
  const activeCustomers = (customers || []).filter((c) => c.is_active).length

  // Group opps by stage for pipeline breakdown
  const stages = ['prospecting', 'qualifying', 'proposal', 'negotiation'] as const
  const stageData = stages.map((stage) => {
    const stageOpps = opps.filter((o) => o.stage === stage)
    const value = stageOpps.reduce((s, o) => s + (o.estimated_value || 0), 0)
    return { stage, count: stageOpps.length, value }
  })

  // Recent opportunities (top 5)
  const recentOpps = opps.slice(0, 5)
  const customerMap = Object.fromEntries(
    (customers || []).map((c) => [c.id, c.name])
  )

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Sales pipeline overview" />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          sub={`${activeOpps.length} active`}
        />
        <StatCard
          label="Weighted Value"
          value={formatCurrency(weightedValue)}
          sub="Based on probability"
          accent="#6366f1"
        />
        <StatCard
          label="Quotes Out"
          value={quotesOut}
          sub={`${formatCurrency(quoteLinesTotal)} total`}
          accent="#d97706"
        />
        <StatCard
          label="Active Customers"
          value={activeCustomers}
          accent="#059669"
        />
      </div>

      {/* Contracts due for renewal */}
      {contractsDueRenewal > 0 && (
        <Link href="/contracts?status=active" className="no-underline block mb-6">
          <div className={`rounded-xl border p-4 flex items-center justify-between ${
            contractsDueUrgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <div>
              <div className={`text-sm font-semibold ${contractsDueUrgent ? 'text-red-700' : 'text-amber-700'}`}>
                {contractsDueRenewal} Contract{contractsDueRenewal !== 1 ? 's' : ''} Due for Renewal
              </div>
              <div className={`text-xs ${contractsDueUrgent ? 'text-red-500' : 'text-amber-500'}`}>
                {contractsDueUrgent ? 'Some expire within 30 days' : 'Within the next 90 days'}
              </div>
            </div>
            <span className={`text-xs font-medium ${contractsDueUrgent ? 'text-red-600' : 'text-amber-600'}`}>
              View &rarr;
            </span>
          </div>
        </Link>
      )}

      {/* Visit scheduling banner */}
      {(visitStats.todayCount > 0 || visitStats.unconfirmedCount > 0) && (
        <Link href="/visit-scheduling" className="no-underline block mb-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-700">
                {visitStats.todayCount > 0
                  ? `${visitStats.todayCount} Visit${visitStats.todayCount !== 1 ? 's' : ''} Today`
                  : `${visitStats.unconfirmedCount} Unconfirmed Visit${visitStats.unconfirmedCount !== 1 ? 's' : ''}`}
              </div>
              <div className="text-xs text-blue-500">
                {visitStats.weekCount} this week{visitStats.bankHolidayPending > 0 ? ` · ${visitStats.bankHolidayPending} on bank holidays` : ''}
              </div>
            </div>
            <span className="text-xs font-medium text-blue-600">View Calendar &rarr;</span>
          </div>
        </Link>
      )}

      {/* Pending collections banner */}
      {pendingCollections > 0 && (
        <Link href="/collections?status=pending" className="no-underline block mb-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-700">
                {pendingCollections} Collection{pendingCollections !== 1 ? 's' : ''} Pending Pickup
              </div>
              <div className="text-xs text-amber-500">
                {collectedToday > 0 ? `${collectedToday} collected today` : 'Awaiting engineer collection'}
              </div>
            </div>
            <span className="text-xs font-medium text-amber-600">View &rarr;</span>
          </div>
        </Link>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Pipeline by Stage</h3>
          {stageData
            .filter((s) => s.count > 0)
            .map((s) => {
              const cfg = STAGE_CONFIG[s.stage as keyof typeof STAGE_CONFIG]
              if (!cfg) return null
              const pct = pipelineValue > 0 ? (s.value / pipelineValue) * 100 : 0
              return (
                <div key={s.stage} className="mb-3.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-[13px] font-medium">
                      {cfg.label} ({s.count})
                    </span>
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: cfg.color }}
                    >
                      {formatCurrency(s.value)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cfg.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          {stageData.every((s) => s.count === 0) && (
            <p className="text-sm text-slate-400">No active opportunities.</p>
          )}
        </div>

        {/* Recent Opportunities */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">
            Recent Opportunities
          </h3>
          {recentOpps.length === 0 ? (
            <p className="text-sm text-slate-400">No opportunities yet.</p>
          ) : (
            recentOpps.map((o) => {
              const cfg =
                STAGE_CONFIG[o.stage as keyof typeof STAGE_CONFIG] || null
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium">{o.title}</div>
                    <div className="text-xs text-slate-400">
                      {customerMap[o.customer_id] || 'Unknown'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold">
                      {formatCurrency(o.estimated_value || 0)}
                    </span>
                    {cfg && (
                      <Badge
                        label={cfg.label}
                        color={cfg.color}
                        bg={cfg.bg}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
