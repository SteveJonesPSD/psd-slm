import { PageHeader } from '@/components/ui/page-header'
import { getCustomersForSelect, getSlaPlans, getContractTypes } from '../../actions'
import { ContractForm } from './contract-form'

export default async function NewContractPage() {
  const [customers, slaResult, contractTypes] = await Promise.all([
    getCustomersForSelect(),
    getSlaPlans(),
    getContractTypes(),
  ])

  return (
    <div>
      <PageHeader title="New Support Contract" />
      <ContractForm
        customers={customers}
        slaPlans={(slaResult.data || []).filter(p => p.is_active)}
        contractTypes={contractTypes}
      />
    </div>
  )
}
