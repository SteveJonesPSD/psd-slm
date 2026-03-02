import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!['super_admin', 'admin'].includes(user.role.name)) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    const { key } = await request.json()
    if (!key) {
      return NextResponse.json({ success: false, message: 'Missing key parameter' }, { status: 400 })
    }

    const supabase = await createClient()

    // Read the full (unmasked) value from database
    const { data, error } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', user.orgId)
      .eq('setting_key', key)
      .single()

    if (error || !data?.setting_value) {
      return NextResponse.json({ success: false, message: 'Key not found or not configured.' })
    }

    const value = data.setting_value as string

    // Test based on key type
    switch (key) {
      case 'anthropic_api_key':
        return await testAnthropicKey(value)
      case 'resend_api_key':
        return await testResendKey(value)
      default:
        return NextResponse.json({ success: false, message: 'No test available for this key.' })
    }
  } catch {
    return NextResponse.json({ success: false, message: 'An unexpected error occurred.' }, { status: 500 })
  }
}

async function testAnthropicKey(apiKey: string) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
    })

    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Anthropic API key is valid. Connection successful.' })
    }

    const errorData = await res.json().catch(() => null)
    const errorMsg = errorData?.error?.message || `HTTP ${res.status}`
    return NextResponse.json({ success: false, message: `Anthropic API error: ${errorMsg}` })
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to connect to Anthropic API.' })
  }
}

async function testResendKey(apiKey: string) {
  try {
    const res = await fetch('https://api.resend.com/api-keys', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Resend API key is valid. Connection successful.' })
    }

    return NextResponse.json({ success: false, message: `Resend API error: HTTP ${res.status}` })
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to connect to Resend API.' })
  }
}
