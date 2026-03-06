import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [] })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10)

  return NextResponse.json({ customers: data || [] })
}
