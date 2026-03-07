import { getContractTypes, getSlaPlanOptions } from '../../contracts/actions'
import { ContractTypesManager } from './contract-types-manager'

export default async function ContractTypesPage() {
  const [types, slaPlans] = await Promise.all([
    getContractTypes(),
    getSlaPlanOptions(),
  ])

  return <ContractTypesManager types={types} slaPlans={slaPlans} />
}
