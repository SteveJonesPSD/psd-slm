import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { PageHeader } from '@/components/ui/page-header'
import { AgentChat } from '@/components/agent-chat'

export default async function HelenPage() {
  const user = await requireAuth()
  const avatars = await getAgentAvatars(user.orgId)

  return (
    <div>
      <PageHeader
        title="Helen — Service Desk Agent"
        subtitle="AI assistant for support ticket queries, SLA information, and troubleshooting guidance"
      />
      <AgentChat
        agentId="helen"
        agentName="Helen"
        agentRole="Service Desk Agent"
        agentColor="#8b5cf6"
        apiEndpoint="/api/agents/helen"
        userName={user.firstName}
        agentAvatarUrl={avatars.helen}
      />
    </div>
  )
}
