import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { AutoCloseSettingsForm } from './auto-close-settings-form'

export default async function HelpdeskSettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('category', 'helpdesk')

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = String(s.setting_value ?? '')
  }

  return (
    <div>
      <PageHeader
        title="Service Desk Settings"
        subtitle="Configure auto-close behaviour for service desk tickets"
      />
      <AutoCloseSettingsForm initialSettings={settingsMap} />
    </div>
  )
}
