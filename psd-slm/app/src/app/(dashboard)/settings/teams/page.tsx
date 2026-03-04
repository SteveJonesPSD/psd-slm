import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { TeamsManager } from './teams-manager'
import { getTeamsWithMembers, getOrgUsers } from './actions'

export default async function TeamsPage() {
  await requireAuth()

  const [teamsResult, usersResult] = await Promise.all([
    getTeamsWithMembers(),
    getOrgUsers(),
  ])

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Organise users into teams for scheduling and other features"
      />
      <TeamsManager
        teams={teamsResult.data || []}
        users={usersResult.data || []}
      />
    </div>
  )
}
