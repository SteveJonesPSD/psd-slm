import { createClient } from '@/lib/supabase/server'

export interface AgentAvatars {
  helen: string | null
  jasper: string | null
  lucia: string | null
}

const AGENT_KEYS: Record<string, keyof AgentAvatars> = {
  agent_helen_avatar: 'helen',
  agent_jasper_avatar: 'jasper',
  agent_lucia_avatar: 'lucia',
}

export async function getAgentAvatars(orgId: string): Promise<AgentAvatars> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'avatars')
    .in('setting_key', Object.keys(AGENT_KEYS))

  const avatars: AgentAvatars = { helen: null, jasper: null, lucia: null }

  for (const row of data || []) {
    const field = AGENT_KEYS[row.setting_key]
    if (field && row.setting_value) {
      avatars[field] = row.setting_value
    }
  }

  return avatars
}
