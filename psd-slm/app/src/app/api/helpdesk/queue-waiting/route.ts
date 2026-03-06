import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data } = await supabase
      .from('v_ticket_summary')
      .select('id, customer_waiting')
      .not('status', 'in', '(closed,cancelled)')

    const map: Record<string, boolean> = {}
    for (const row of data || []) {
      if (row.customer_waiting) {
        map[row.id] = true
      }
    }

    return NextResponse.json(map)
  } catch {
    return NextResponse.json({})
  }
}
