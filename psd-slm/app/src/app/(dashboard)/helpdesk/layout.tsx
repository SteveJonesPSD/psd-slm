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
    <div className="flex flex-col md:flex-row gap-0 -m-4 md:-m-6 lg:-m-8 min-h-[calc(100vh-60px)]">
      <div className="hidden md:block">
        <HelpdeskNav isAdmin={isAdmin} tags={tags || []} />
      </div>
      <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
        {children}
      </div>
    </div>
  )
}
