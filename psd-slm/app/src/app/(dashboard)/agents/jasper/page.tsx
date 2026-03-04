import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { PageHeader } from '@/components/ui/page-header'
import { AgentChat } from '@/components/agent-chat'

export default async function JasperPage() {
  const user = await requireAuth()
  const avatars = await getAgentAvatars(user.orgId)

  return (
    <div>
      <PageHeader
        title="Jasper — Sales Agent"
        subtitle="AI assistant for pipeline questions, quote preparation, and sales strategy"
      />
      <AgentChat
        agentId="jasper"
        agentName="Jasper"
        agentRole="Sales Agent"
        agentColor="#3b82f6"
        apiEndpoint="/api/agents/jasper"
        userName={user.firstName}
        agentAvatarUrl={avatars.jasper}
      />
    </div>
  )
}
