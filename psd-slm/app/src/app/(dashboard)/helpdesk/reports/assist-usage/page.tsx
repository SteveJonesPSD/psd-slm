import { requirePermission } from '@/lib/auth'
import { getTeamMembers, getHelenAssistUsage } from '../../actions'
import { AssistUsageView } from './assist-usage-view'

export default async function AssistUsagePage() {
  await requirePermission('helpdesk', 'admin')

  const [usageResult, teamMembers] = await Promise.all([
    getHelenAssistUsage(),
    getTeamMembers(),
  ])

  return (
    <AssistUsageView
      usage={usageResult.data || []}
      teamMembers={teamMembers}
    />
  )
}
