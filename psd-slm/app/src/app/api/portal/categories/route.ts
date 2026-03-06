import { NextRequest, NextResponse } from 'next/server'
import { getPortalContextFromRequest } from '@/lib/portal/session'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const ctx = await getPortalContextFromRequest(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ticket_categories')
    .select('id, name')
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .order('sort_order')

  return NextResponse.json(data || [])
}
