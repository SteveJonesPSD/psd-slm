import { getContractTypes } from '../../contracts/actions'
import { ContractTypesManager } from './contract-types-manager'

export default async function ContractTypesPage() {
  const types = await getContractTypes()

  return <ContractTypesManager types={types} />
}
