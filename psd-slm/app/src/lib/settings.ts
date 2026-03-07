import { createClient } from '@/lib/supabase/server'

export interface PortalBranding {
  logoUrl: string | null
  orgName: string
}

export async function getPortalBranding(orgId: string): Promise<PortalBranding> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('org_settings')
      .select('setting_key, setting_value')
      .eq('org_id', orgId)
      .eq('category', 'general')
      .in('setting_key', ['portal_logo_url', 'org_name'])

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.setting_key] = row.setting_value
    }

    return {
      logoUrl: settings.portal_logo_url || null,
      orgName: settings.org_name || 'Innov8iv Engage',
    }
  } catch {
    return { logoUrl: null, orgName: 'Innov8iv Engage' }
  }
}

/** @deprecated Use getPortalBranding instead */
export async function getPortalLogoUrl(orgId: string): Promise<string | null> {
  const branding = await getPortalBranding(orgId)
  return branding.logoUrl
}
