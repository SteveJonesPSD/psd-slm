import { getMacros, getTags, getTeamMembers } from '../actions'
import { requirePermission } from '@/lib/auth'
import { MacrosManager } from './macros-manager'

export default async function MacrosPage() {
  await requirePermission('helpdesk', 'admin')
  const [macrosResult, tagsResult, teamMembers] = await Promise.all([
    getMacros(),
    getTags(),
    getTeamMembers(),
  ])

  return (
    <MacrosManager
      initialMacros={macrosResult.data || []}
      tags={(tagsResult.data || []).filter((t) => t.is_ai_assignable)}
      teamMembers={teamMembers}
    />
  )
}
