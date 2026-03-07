import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { HelpdeskNav } from './helpdesk-nav'

export default async function HelpdeskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requirePermission('helpdesk', 'view')
  const isAdmin = user.permissions.includes('helpdesk.admin')
  const supabase = await createClient()

  const { data: tags } = await supabase
    .from('ticket_tags')
    .select('id, name, color')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <div className="mb-6">
        <HelpdeskNav isAdmin={isAdmin} tags={tags || []} />
      </div>
      {children}
    </div>
  )
}
