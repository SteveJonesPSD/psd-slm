import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getMailConnections, getMailChannels, getProcessingLog, getAutoPollingEnabled } from '@/lib/email/actions'
import { EmailIntegrationSettings } from './email-integration-settings'

export default async function EmailSettingsPage() {
  const user = await requireAuth()

  const [connectionsResult, channelsResult, logResult, autoPollingEnabled] = await Promise.all([
    getMailConnections(),
    getMailChannels(),
    getProcessingLog(20),
    getAutoPollingEnabled(),
  ])

  return (
    <div>
      <PageHeader
        title="Email Integration"
        subtitle="Connect Microsoft 365 mailboxes to route inbound emails to modules"
      />
      <EmailIntegrationSettings
        connections={connectionsResult.data || []}
        channels={channelsResult.data || []}
        processingLog={logResult.data || []}
        orgId={user.orgId}
        autoPollingEnabled={autoPollingEnabled}
      />
    </div>
  )
}
