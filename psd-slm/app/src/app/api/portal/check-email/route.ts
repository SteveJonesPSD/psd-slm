import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const supabase = createAdminClient()

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ found: !!contact })
  } catch {
    return NextResponse.json({ found: false }, { status: 500 })
  }
}
