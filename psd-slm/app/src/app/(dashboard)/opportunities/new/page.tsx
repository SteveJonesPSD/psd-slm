import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { OpportunityForm } from '../opportunity-form'

interface PageProps {
  searchParams: Promise<{ company_id?: string }>
}

export default async function NewOpportunityPage({ searchParams }: PageProps) {
  const user = await requirePermission('pipeline', 'create')
  const supabase = await createClient()
  const { company_id } = await searchParams

  const [{ data: customers }, { data: contacts }, { data: users }] = await Promise.all([
    supabase.from('customers').select('id, name').eq('org_id', user.orgId).eq('is_active', true).order('name'),
    supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId).eq('is_active', true).order('first_name'),
  ])

  return (
    <div>
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Pipeline
      </Link>

      <PageHeader title="New Opportunity" />

      <OpportunityForm
        customers={customers || []}
        contacts={contacts || []}
        users={users || []}
        defaultCustomerId={company_id}
        currentUserId={user.id}
      />
    </div>
  )
}
