import { PageHeader } from '@/components/ui/page-header'
import { getInboundPOs } from './actions'
import { InboundPOTable } from './inbound-po-table'

export default async function InboundPOsPage() {
  const result = await getInboundPOs()
  const items = result.data || []

  return (
    <div>
      <PageHeader
        title="Customer Purchase Orders"
        subtitle={`${items.length} purchase order${items.length === 1 ? '' : 's'}`}
      />
      <InboundPOTable initialData={items} />
    </div>
  )
}
