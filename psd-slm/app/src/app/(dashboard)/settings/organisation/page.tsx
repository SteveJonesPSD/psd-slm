import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { OrganisationForm } from './organisation-form'

export default async function OrganisationSettingsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .eq('category', 'general')

  // Convert to key-value map
  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = (s.setting_value as string) ?? ''
  }

  return (
    <div>
      <PageHeader
        title="Organisation"
        subtitle="General settings for your organisation"
      />
      <OrganisationForm initialSettings={settingsMap} />
    </div>
  )
}
