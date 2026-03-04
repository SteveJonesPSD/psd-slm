import { PageHeader } from '@/components/ui/page-header'
import { getSlaPlans } from '../actions'
import { SlaPlansManager } from './sla-plans-manager'

export default async function SlaPlansPage() {
  const result = await getSlaPlans()
  const plans = result.data || []

  return (
    <div>
      <PageHeader
        title="SLA Plans"
        subtitle={`${plans.length} plans`}
      />
      <SlaPlansManager initialData={plans} />
    </div>
  )
}
