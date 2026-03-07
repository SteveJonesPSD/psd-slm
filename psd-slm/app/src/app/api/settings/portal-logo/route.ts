import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('org_settings')
      .select('setting_key, setting_value')
      .eq('category', 'general')
      .in('setting_key', ['portal_logo_url', 'org_name'])

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.setting_key] = row.setting_value
    }

    return NextResponse.json({
      url: settings.portal_logo_url || null,
      orgName: settings.org_name || 'Innov8iv Engage',
    })
  } catch {
    return NextResponse.json({ url: null, orgName: 'Innov8iv Engage' })
  }
}
