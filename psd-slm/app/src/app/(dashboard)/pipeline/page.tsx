import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { PipelineBoard } from './pipeline-board'
import Link from 'next/link'

export default async function PipelinePage() {
  const user = await requirePermission('pipeline', 'view')
  const supabase = await createClient()

  // Fetch ALL opportunities (including won/lost) so client can toggle
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', user.orgId)

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, customer_id, first_name, last_name')

  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color')
    .eq('org_id', user.orgId)

  const activeCount = (opportunities || []).filter(
    (o) => !['won', 'lost'].includes(o.stage)
  ).length

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={`${activeCount} active opportunities`}
        actions={
          <Link href="/opportunities/new">
            <Button size="sm" variant="primary">+ New Opportunity</Button>
          </Link>
        }
      />
      <PipelineBoard
        opportunities={opportunities || []}
        customers={customers || []}
        contacts={contacts || []}
        users={users || []}
        currentUser={user}
      />
    </div>
  )
}
