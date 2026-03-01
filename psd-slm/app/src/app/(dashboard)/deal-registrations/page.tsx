import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { DealRegistrationsTable } from './deal-registrations-table'

export default async function DealRegistrationsPage() {
  const supabase = await createClient()

  const { data: dealRegs } = await supabase
    .from('deal_registrations')
    .select(`
      *,
      customers(id, name),
      suppliers(id, name),
      users!deal_registrations_registered_by_fkey(id, first_name, last_name, initials, color),
      deal_registration_lines(id)
    `)
    .order('created_at', { ascending: false })

  const mapped = (dealRegs || []).map((dr) => {
    const customer = dr.customers as unknown as { id: string; name: string } | null
    const supplier = dr.suppliers as unknown as { id: string; name: string } | null
    const registeredByUser = dr.users as unknown as { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
    const lines = dr.deal_registration_lines as unknown as { id: string }[]

    return {
      ...dr,
      customer_name: customer?.name || '\u2014',
      supplier_name: supplier?.name || '\u2014',
      registered_by_name: registeredByUser
        ? `${registeredByUser.first_name} ${registeredByUser.last_name}`
        : null,
      registered_by_initials: registeredByUser?.initials || null,
      registered_by_color: registeredByUser?.color || null,
      line_count: lines?.length ?? 0,
    }
  })

  // Build unique customer/supplier lists for filter dropdowns
  const customerMap = new Map<string, string>()
  const supplierMap = new Map<string, string>()
  for (const dr of mapped) {
    if (dr.customer_id && dr.customer_name !== '\u2014') customerMap.set(dr.customer_id, dr.customer_name)
    if (dr.supplier_id && dr.supplier_name !== '\u2014') supplierMap.set(dr.supplier_id, dr.supplier_name)
  }
  const customerOptions = Array.from(customerMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  const supplierOptions = Array.from(supplierMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <PageHeader
        title="Deal Registrations"
        subtitle={`${mapped.length} registration${mapped.length === 1 ? '' : 's'}`}
      />
      <DealRegistrationsTable
        dealRegs={mapped}
        customerOptions={customerOptions}
        supplierOptions={supplierOptions}
      />
    </div>
  )
}
