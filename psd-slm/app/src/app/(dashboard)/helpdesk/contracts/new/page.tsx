import { PageHeader } from '@/components/ui/page-header'
import { getCustomersForSelect, getSlaPlans } from '../../actions'
import { ContractForm } from './contract-form'

export default async function NewContractPage() {
  const [customers, slaResult] = await Promise.all([
    getCustomersForSelect(),
    getSlaPlans(),
  ])

  return (
    <div>
      <PageHeader title="New Support Contract" />
      <ContractForm
        customers={customers}
        slaPlans={(slaResult.data || []).filter(p => p.is_active)}
      />
    </div>
  )
}
