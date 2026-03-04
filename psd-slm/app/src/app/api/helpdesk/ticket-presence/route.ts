import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GC_THRESHOLD_MS = 5 * 60 * 1000      // 5 minutes — delete stale rows
const VIEWER_THRESHOLD_MS = 45 * 1000       // 45 seconds — 3 missed beats = gone

export async function POST(request: NextRequest) {
  try {
    // sendBeacon can only POST — use _method=DELETE query param to route clear requests
    const methodOverride = request.nextUrl.searchParams.get('_method')
    if (methodOverride === 'DELETE') {
      return handleDelete(request)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { ticketId } = await request.json()
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Upsert own heartbeat
    await supabase
      .from('ticket_presence')
      .upsert(
        { ticket_id: ticketId, user_id: appUser.id, last_heartbeat: now },
        { onConflict: 'ticket_id,user_id' }
      )

    // Garbage-collect stale rows
    const gcThreshold = new Date(Date.now() - GC_THRESHOLD_MS).toISOString()
    await supabase
      .from('ticket_presence')
      .delete()
      .eq('ticket_id', ticketId)
      .lt('last_heartbeat', gcThreshold)

    // Fetch other active viewers
    const threshold = new Date(Date.now() - VIEWER_THRESHOLD_MS).toISOString()
    const { data } = await supabase
      .from('ticket_presence')
      .select('user_id, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
      .eq('ticket_id', ticketId)
      .gt('last_heartbeat', threshold)
      .neq('user_id', appUser.id)

    const viewers = (data || []).map((row: Record<string, unknown>) => {
      const u = row.users as Record<string, unknown>
      return {
        id: u.id as string,
        firstName: u.first_name as string,
        lastName: u.last_name as string,
        initials: (u.initials as string) || null,
        color: (u.color as string) || null,
        avatarUrl: (u.avatar_url as string) || null,
      }
    })

    return NextResponse.json({ viewers })
  } catch {
    return NextResponse.json({ viewers: [] })
  }
}

async function handleDelete(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: true })

    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!appUser) return NextResponse.json({ ok: true })

    const { ticketId } = await request.json()
    if (ticketId) {
      await supabase
        .from('ticket_presence')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('user_id', appUser.id)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

export async function DELETE(request: NextRequest) {
  return handleDelete(request)
}
