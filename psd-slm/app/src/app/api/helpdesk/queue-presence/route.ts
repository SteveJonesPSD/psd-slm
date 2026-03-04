import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VIEWER_THRESHOLD_MS = 45 * 1000 // 45 seconds — 3 missed beats = gone

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const threshold = new Date(Date.now() - VIEWER_THRESHOLD_MS).toISOString()
    const { data } = await supabase
      .from('ticket_presence')
      .select('ticket_id, user_id, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
      .gt('last_heartbeat', threshold)

    const map: Record<string, { id: string; firstName: string; lastName: string; initials: string | null; color: string | null; avatarUrl: string | null }[]> = {}
    for (const row of (data || []) as Record<string, unknown>[]) {
      const ticketId = row.ticket_id as string
      const u = row.users as Record<string, unknown>
      if (!u) continue
      const viewer = {
        id: u.id as string,
        firstName: u.first_name as string,
        lastName: u.last_name as string,
        initials: (u.initials as string) || null,
        color: (u.color as string) || null,
        avatarUrl: (u.avatar_url as string) || null,
      }
      if (!map[ticketId]) map[ticketId] = []
      map[ticketId].push(viewer)
    }

    return NextResponse.json(map)
  } catch {
    return NextResponse.json({})
  }
}
