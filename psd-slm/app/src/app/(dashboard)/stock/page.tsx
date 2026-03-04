import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { getStockLevels } from './actions'
import { StockTable } from './stock-table'

export default async function StockPage() {
  await requirePermission('stock', 'view')
  const stockLevels = await getStockLevels()

  const totalSkus = stockLevels.length
  const totalValue = stockLevels.reduce((sum, s) => {
    return sum + s.quantity_on_hand * (s.default_buy_price || 0)
  }, 0)
  const belowReorder = stockLevels.filter(s => s.below_reorder).length
  const pendingAllocations = stockLevels.reduce((sum, s) => sum + s.quantity_allocated, 0)

  return (
    <div>
      <PageHeader
        title="Stock Levels"
        subtitle="Manage inventory across all locations"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="SKUs in Stock" value={totalSkus} accent="#1e293b" />
        <StatCard label="Total Stock Value" value={formatCurrency(totalValue)} accent="#6366f1" />
        <StatCard label="Below Reorder" value={belowReorder} accent={belowReorder > 0 ? '#dc2626' : '#059669'} />
        <StatCard label="Pending Allocations" value={pendingAllocations} accent="#d97706" />
      </div>

      <StockTable stockLevels={stockLevels} />
    </div>
  )
}
