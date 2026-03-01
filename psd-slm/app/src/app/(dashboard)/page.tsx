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
      <div className="flex flex-wrap gap-4 mb-7">
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

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
