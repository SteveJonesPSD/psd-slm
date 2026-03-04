import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getStockMovements } from '../actions'
import { MovementsTable } from './movements-table'

interface PageProps {
  searchParams: Promise<{ product_id?: string }>
}

export default async function StockMovementsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  await requirePermission('stock', 'view')
  const movements = await getStockMovements(
    sp.product_id ? { productId: sp.product_id } : undefined
  )

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        subtitle="Audit trail of all stock changes"
      />

      <MovementsTable movements={movements} preFilterProductId={sp.product_id} />
    </div>
  )
}
