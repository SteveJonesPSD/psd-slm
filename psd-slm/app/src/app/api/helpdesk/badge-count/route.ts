import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0 })

    const { data: appUser } = await supabase
      .from('users')
      .select('id, user_roles(roles(name))')
      .eq('auth_id', user.id)
      .single()

    if (!appUser) return NextResponse.json({ count: 0 })

    const roleName = (appUser as any).user_roles?.[0]?.roles?.name

    // Engineering roles (tech, field) see all new tickets
    const isEngineer = roleName === 'tech' || roleName === 'field'

    if (isEngineer) {
      const { count } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      return NextResponse.json({ count: count ?? 0 })
    }

    // Non-engineers: only tickets assigned to them or they are watching
    // Get watched ticket IDs
    const { data: watchedRows } = await supabase
      .from('ticket_watchers')
      .select('ticket_id')
      .eq('user_id', appUser.id)

    const watchedIds = (watchedRows ?? []).map(r => r.ticket_id)

    // Count new tickets where assigned to user OR in watched list
    let query = supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')

    if (watchedIds.length > 0) {
      query = query.or(`assigned_to.eq.${appUser.id},id.in.(${watchedIds.join(',')})`)
    } else {
      query = query.eq('assigned_to', appUser.id)
    }

    const { count } = await query
    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
