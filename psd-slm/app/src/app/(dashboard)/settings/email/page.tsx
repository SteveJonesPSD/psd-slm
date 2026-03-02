import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { EmailSettingsForm } from './email-settings-form'

export default async function EmailSettingsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .eq('category', 'email')

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = (s.setting_value as string) ?? ''
  }

  return (
    <div>
      <PageHeader
        title="Email"
        subtitle="Configure email delivery and templates"
      />
      <EmailSettingsForm initialSettings={settingsMap} />
    </div>
  )
}
