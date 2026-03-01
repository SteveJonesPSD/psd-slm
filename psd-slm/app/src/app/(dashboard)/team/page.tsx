import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { TeamTable } from './team-table'
import type { User, Role } from '@/types/database'

type UserWithRole = User & { roles: { id: string; name: string; display_name: string } }

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select('*, roles(id, name, display_name)')
    .order('first_name')

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, display_name')
    .order('sort_order')

  const allUsers = (users as UserWithRole[]) || []
  const activeCount = allUsers.filter((u) => u.is_active).length
  const inactiveCount = allUsers.length - activeCount

  const subtitle = inactiveCount > 0
    ? `${activeCount} active, ${inactiveCount} inactive`
    : `${activeCount} active members`

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={subtitle}
      />
      <TeamTable
        users={allUsers}
        roles={(roles as Pick<Role, 'id' | 'name' | 'display_name'>[]) || []}
      />
    </div>
  )
}
