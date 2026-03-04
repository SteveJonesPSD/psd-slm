import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'
import { getContracts } from '../actions'
import { ContractsTable } from './contracts-table'

export default async function ContractsPage() {
  const result = await getContracts()
  const contracts = result.data || []

  return (
    <div>
      <PageHeader
        title="Support Contracts"
        subtitle={`${contracts.length} contracts`}
        actions={
          <Link
            href="/helpdesk/contracts/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
          >
            New Contract
          </Link>
        }
      />
      <ContractsTable data={contracts} />
    </div>
  )
}
