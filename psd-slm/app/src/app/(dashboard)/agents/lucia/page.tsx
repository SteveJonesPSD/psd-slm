import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { PageHeader } from '@/components/ui/page-header'
import { AgentChat } from '@/components/agent-chat'

export default async function LuciaPage() {
  const user = await requireAuth()
  const avatars = await getAgentAvatars(user.orgId)

  return (
    <div>
      <PageHeader
        title="Lucia — Administration Agent"
        subtitle="AI assistant for purchasing, stock, invoicing, delivery tracking, and onsite scheduling"
      />
      <AgentChat
        agentId="lucia"
        agentName="Lucia"
        agentRole="Administration Agent"
        agentColor="#10b981"
        apiEndpoint="/api/agents/lucia"
        userName={user.firstName}
        agentAvatarUrl={avatars.lucia}
      />
    </div>
  )
}
