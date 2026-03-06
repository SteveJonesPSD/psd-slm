import { createClient } from '@/lib/supabase/server'
import { CustomersPageClient } from './customers-page-client'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('*, contacts(id)')
    .order('name')

  return <CustomersPageClient customers={customers || []} />
}
