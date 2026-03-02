import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { ApiKeysPanel } from './api-keys-panel'

export default async function ApiKeysPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get all integration settings (masked)
  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value, is_secret')
    .eq('org_id', user.orgId)
    .eq('category', 'integrations')

  const settingsMap: Record<string, { value: string | null; isSet: boolean }> = {}
  for (const s of settings || []) {
    const raw = s.setting_value as string | null
    const isSet = !!raw && raw.length > 0
    settingsMap[s.setting_key] = {
      value: isSet && s.is_secret ? maskValue(raw!) : raw,
      isSet,
    }
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle="Manage third-party service credentials"
      />
      <ApiKeysPanel initialSettings={settingsMap} />
    </div>
  )
}

function maskValue(value: string): string {
  if (value.length <= 11) return '••••••••'
  return value.substring(0, 7) + '...' + value.substring(value.length - 4)
}
