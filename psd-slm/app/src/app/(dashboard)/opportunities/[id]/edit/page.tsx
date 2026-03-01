import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, hasPermission, hasAnyPermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { OpportunityForm } from '../../opportunity-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditOpportunityPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireAuth()

  if (
    !hasAnyPermission(user, [
      { module: 'pipeline', action: 'edit_all' },
      { module: 'pipeline', action: 'edit_own' },
    ])
  ) {
    throw new Error('Permission denied: pipeline.edit')
  }

  const supabase = await createClient()

  const [{ data: opportunity }, { data: customers }, { data: contacts }, { data: users }] =
    await Promise.all([
      supabase.from('opportunities').select('*').eq('id', id).single(),
      supabase.from('customers').select('id, name').eq('org_id', user.orgId).eq('is_active', true).order('name'),
      supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
      supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId).eq('is_active', true).order('first_name'),
    ])

  if (!opportunity) notFound()

  return (
    <div>
      <Link
        href={`/opportunities/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Back to opportunity
      </Link>

      <PageHeader title="Edit Opportunity" subtitle={opportunity.title} />

      <OpportunityForm
        opportunity={opportunity}
        customers={customers || []}
        contacts={contacts || []}
        users={users || []}
      />
    </div>
  )
}
