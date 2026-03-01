import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { CustomersTable } from './customers-table'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('*, contacts(id)')
    .order('name')

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers?.length || 0} accounts`}
      />
      <CustomersTable customers={customers || []} />
    </div>
  )
}
