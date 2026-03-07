import { PageHeader } from '@/components/ui/page-header'
import { TeamsNotificationSettings } from './teams-notification-settings'
import { getTeamsSettings, getEngineersForTeams } from '@/lib/teams/actions'

export default async function TeamsNotificationsPage() {
  const [settings, engineers] = await Promise.all([
    getTeamsSettings(),
    getEngineersForTeams(),
  ])

  return (
    <div>
      <PageHeader
        title="Teams Notifications"
        subtitle="Notify engineers via Microsoft Teams when jobs are booked or changed."
      />
      <TeamsNotificationSettings initialSettings={settings} engineers={engineers} />
    </div>
  )
}
