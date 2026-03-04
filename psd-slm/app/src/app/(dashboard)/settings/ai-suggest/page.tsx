import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { AiSuggestSettingsForm } from './ai-suggest-settings-form'

export default async function AiSuggestSettingsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .eq('category', 'ai_suggest')

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = (s.setting_value as string) ?? ''
  }

  return (
    <div>
      <PageHeader
        title="AI Suggest"
        subtitle="Configure AI response style and behaviour for helpdesk suggestions"
      />
      <AiSuggestSettingsForm initialSettings={settingsMap} />
    </div>
  )
}
