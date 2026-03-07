import { createClient } from '@/lib/supabase/server'
import { CustomersPageClient } from './customers-page-client'

export default async function CustomersPage() {
  const supabase = await createClient()

  const [{ data: customers }, { data: groups }, { data: members }] = await Promise.all([
    supabase.from('customers').select('*, contacts(id)').order('name'),
    supabase.from('company_groups').select('id, name, parent_company_id, group_type').eq('is_active', true),
    supabase.from('company_group_members').select('company_id, group_id, company_groups(name)'),
  ])

  // Build a map of companyId → group info for badges
  const groupBadges: Record<string, { type: 'parent' | 'member'; groupName: string }> = {}
  for (const g of groups || []) {
    groupBadges[g.parent_company_id] = { type: 'parent', groupName: g.name }
  }
  for (const m of members || []) {
    if (!groupBadges[m.company_id]) {
      const gName = (m.company_groups as unknown as { name: string } | null)?.name || ''
      if (gName) groupBadges[m.company_id] = { type: 'member', groupName: gName }
    }
  }

  return <CustomersPageClient customers={customers || []} groupBadges={groupBadges} />
}
