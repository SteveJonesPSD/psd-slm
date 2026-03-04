import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { HelenSettingsForm } from './helen-settings-form'

export default async function HelenSettingsPage() {
  await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('category', 'helen')

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = String(s.setting_value ?? '')
  }

  return (
    <div>
      <PageHeader
        title="Helen AI"
        subtitle="Configure the Helen AI service desk agent — auto-acknowledgement, triage, and draft responses"
      />
      <HelenSettingsForm initialSettings={settingsMap} />
    </div>
  )
}
