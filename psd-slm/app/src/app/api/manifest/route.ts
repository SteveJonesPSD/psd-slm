import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  let iconUrl: string | null = null
  let orgName = 'Innov8iv Engage'

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('org_settings')
      .select('setting_key, setting_value')
      .eq('category', 'general')
      .in('setting_key', ['webapp_icon_url', 'org_name'])

    for (const row of data || []) {
      if (row.setting_key === 'webapp_icon_url' && row.setting_value) iconUrl = row.setting_value
      if (row.setting_key === 'org_name' && row.setting_value) orgName = row.setting_value
    }
  } catch {
    // Fall back to defaults
  }

  const icons = iconUrl
    ? [
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
      ]

  const manifest = {
    name: orgName,
    short_name: 'Engage',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#1e293b',
    icons,
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
