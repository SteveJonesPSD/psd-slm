import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { Badge, STOCK_TAKE_STATUS_CONFIG } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getStockTake } from '../../actions'
import { StockTakeCounter } from './stock-take-counter'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StockTakeDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('stock', 'view')

  const st = await getStockTake(id)
  if (!st) notFound()

  const statusCfg = STOCK_TAKE_STATUS_CONFIG[st.status]
  const location = st.location as { name: string; code: string } | null
  const starter = st.starter as { first_name: string; last_name: string } | null

  return (
    <div>
      <Link
        href="/stock/takes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; All Stock Takes
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{st.st_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
          </div>
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {location && <span>{location.name} ({location.code})</span>}
            {starter && <span>Started by {starter.first_name} {starter.last_name}</span>}
            <span>{formatDate(st.created_at)}</span>
          </div>
        </div>
      </div>

      <StockTakeCounter
        stockTakeId={st.id}
        status={st.status}
        lines={st.lines}
      />
    </div>
  )
}
