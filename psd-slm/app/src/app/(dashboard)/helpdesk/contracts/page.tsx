import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <Link href="/helpdesk/contracts/new">
            <Button size="sm" variant="primary">New Contract</Button>
          </Link>
        }
      />
      <ContractsTable data={contracts} />
    </div>
  )
}
