import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { blindIndex } from '@/lib/crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ found: false })
    }
    const supabase = createAdminClient()

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email_blind', blindIndex(email.trim().toLowerCase()))
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ found: !!contact })
  } catch {
    return NextResponse.json({ found: false }, { status: 500 })
  }
}
