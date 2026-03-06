import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { TeamTable } from './team-table'
import { MailCallbackBanner } from './mail-callback-banner'
import type { User, Role } from '@/types/database'
import type { UserMailCredential } from '@/lib/email/types'

type UserWithRole = User & { roles: { id: string; name: string; display_name: string } }

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase.from('users').select('*, roles(id, name, display_name)').order('first_name'),
    supabase.from('roles').select('id, name, display_name').order('sort_order'),
  ])

  // Fetch mail credentials (admin client to see all users' creds)
  let mailCredentials: UserMailCredential[] = []
  if (user && ['super_admin', 'admin'].includes(user.role.name)) {
    const adminSupabase = createAdminClient()
    const { data: creds } = await adminSupabase
      .from('user_mail_credentials')
      .select('*')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
    mailCredentials = (creds || []) as UserMailCredential[]
  }

  const allUsers = (users as UserWithRole[]) || []
  const activeCount = allUsers.filter((u) => u.is_active).length
  const inactiveCount = allUsers.length - activeCount

  const subtitle = inactiveCount > 0
    ? `${activeCount} active, ${inactiveCount} inactive`
    : `${activeCount} active members`

  const mailError = typeof params.mail_error === 'string' ? params.mail_error : undefined
  const mailConnected = params.mail_connected === 'true'
  const mailEmail = typeof params.mail_email === 'string' ? params.mail_email : undefined

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={subtitle}
      />
      <MailCallbackBanner error={mailError} connected={mailConnected} email={mailEmail} />
      <TeamTable
        users={allUsers}
        roles={(roles as Pick<Role, 'id' | 'name' | 'display_name'>[]) || []}
        mailCredentials={mailCredentials}
      />
    </div>
  )
}
