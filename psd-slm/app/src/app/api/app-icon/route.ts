import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('category', 'general')
      .eq('setting_key', 'webapp_icon_url')
      .limit(1)
      .maybeSingle()

    if (data?.setting_value) {
      return NextResponse.redirect(data.setting_value)
    }
  } catch {
    // Fall back to default
  }

  const url = new URL('/favicon.ico', request.url)
  return NextResponse.redirect(url)
}
