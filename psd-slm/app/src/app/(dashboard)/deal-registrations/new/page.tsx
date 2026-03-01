import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { DealRegForm } from '../deal-reg-form'

export default async function NewDealRegistrationPage() {
  const user = await requirePermission('deal_registrations', 'create')
  const supabase = await createClient()

  const [{ data: customers }, { data: suppliers }, { data: products }, { data: users }] =
    await Promise.all([
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, sku, name, default_buy_price').eq('is_active', true).order('name'),
      supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId).eq('is_active', true).order('first_name'),
    ])

  return (
    <div>
      <Link
        href="/deal-registrations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Deal Registrations
      </Link>

      <PageHeader title="New Deal Registration" />
      <DealRegForm
        customers={customers || []}
        suppliers={suppliers || []}
        products={products || []}
        users={users || []}
        currentUserId={user.id}
      />
    </div>
  )
}
