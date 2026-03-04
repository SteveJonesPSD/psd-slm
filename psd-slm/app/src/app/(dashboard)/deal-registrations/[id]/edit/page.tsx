import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { DealRegForm } from '../../deal-reg-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditDealRegistrationPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireAuth()
  const canEdit = hasPermission(user, 'deal_registrations', 'edit_all') || hasPermission(user, 'deal_registrations', 'edit_own')
  if (!canEdit) notFound()
  const supabase = await createClient()

  const [{ data: dealReg }, { data: customers }, { data: suppliers }, { data: products }, { data: users }] =
    await Promise.all([
      supabase
        .from('deal_registrations')
        .select('*, deal_registration_lines(*)')
        .eq('id', id)
        .single(),
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, sku, name, default_buy_price').eq('is_active', true).order('name'),
      supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId).eq('is_active', true).order('first_name'),
    ])

  if (!dealReg) notFound()

  return (
    <div>
      <Link
        href={`/deal-registrations/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; {dealReg.title}
      </Link>

      <PageHeader title="Edit Deal Registration" subtitle={dealReg.title} />
      <DealRegForm
        dealReg={dealReg}
        customers={customers || []}
        suppliers={suppliers || []}
        products={products || []}
        users={users || []}
        currentUserId={user.id}
      />
    </div>
  )
}
