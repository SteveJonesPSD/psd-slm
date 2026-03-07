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
      // Proxy the image directly — iOS apple-touch-icon doesn't follow redirects
      const imgRes = await fetch(data.setting_value)
      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') || 'image/png'
        const body = await imgRes.arrayBuffer()
        return new NextResponse(body, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        })
      }
    }
  } catch {
    // Fall back to default
  }

  // Fallback: serve favicon.ico
  const url = new URL('/favicon.ico', request.url)
  return NextResponse.redirect(url)
}
