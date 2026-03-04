import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get('postcode')

  if (!postcode?.trim()) {
    return NextResponse.json(
      { error: 'Missing postcode parameter', hint: 'Usage: /api/address-lookup?postcode=BH24+3BA' },
      { status: 400 }
    )
  }

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = await createClient()

  // Read Ideal Postcodes API key from org_settings
  const { data: setting, error: settingError } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'ideal_postcodes_api_key')
    .single()

  if (settingError || !setting?.setting_value) {
    return NextResponse.json(
      { error: 'Address lookup not configured. Add an Ideal Postcodes API key in Settings > API Keys.' },
      { status: 400 }
    )
  }

  const raw = setting.setting_value
  const apiKey = typeof raw === 'string' ? raw : String(raw)
  const cleanPostcode = postcode.trim().replace(/\s+/g, '')

  // Ideal Postcodes API: https://docs.ideal-postcodes.co.uk/docs/api/postcodes
  const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(cleanPostcode)}?api_key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (!res.ok || data.code !== 2000) {
      if (data.code === 4040) {
        return NextResponse.json({ error: 'Postcode not found' }, { status: 404 })
      }
      if (data.code === 4010 || data.code === 4012) {
        return NextResponse.json({ error: 'Invalid Ideal Postcodes API key. Check Settings > API Keys.' }, { status: 401 })
      }
      if (data.code === 4020) {
        return NextResponse.json({ error: 'Ideal Postcodes key has no remaining lookups. Top up your balance.' }, { status: 402 })
      }
      if (data.code === 4021) {
        return NextResponse.json({ error: 'Ideal Postcodes daily limit reached. Try again tomorrow.' }, { status: 429 })
      }
      return NextResponse.json({ error: `Address lookup failed: ${data.message || res.status}` }, { status: 502 })
    }

    const addresses = (data.result || []).map((addr: {
      line_1: string
      line_2: string
      line_3: string
      post_town: string
      county: string
      postcode: string
    }) => ({
      line_1: addr.line_1 || '',
      line_2: [addr.line_2, addr.line_3].filter(Boolean).join(', '),
      city: addr.post_town || '',
      county: addr.county || '',
      postcode: addr.postcode || cleanPostcode.toUpperCase(),
    }))

    return NextResponse.json({ postcode: addresses[0]?.postcode || cleanPostcode.toUpperCase(), addresses })
  } catch {
    return NextResponse.json({ error: 'Failed to connect to Ideal Postcodes' }, { status: 502 })
  }
}
