import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getStockLocations } from '../../actions'
import { AdjustmentForm } from './adjustment-form'

export default async function NewAdjustmentPage() {
  await requirePermission('stock', 'create')
  const locations = await getStockLocations()

  return (
    <div>
      <PageHeader
        title="Stock Adjustment"
        subtitle="Manually adjust stock levels"
      />

      <AdjustmentForm locations={locations} />
    </div>
  )
}
