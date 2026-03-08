import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = request.nextUrl
  const engineerId = searchParams.get('engineerId')
  const dayOfWeek = parseInt(searchParams.get('dayOfWeek') || '0')

  if (!engineerId || !dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) {
    return NextResponse.json({ error: 'Missing engineerId or dayOfWeek' }, { status: 400 })
  }

  const { data } = await supabase
    .from('user_working_hours')
    .select('start_time, end_time, is_working_day')
    .eq('user_id', engineerId)
    .eq('day_of_week', dayOfWeek)
    .single()

  // Return the engineer-specific hours, or null fields to signal "use org defaults"
  return NextResponse.json({
    start_time: data?.start_time || null,
    end_time: data?.end_time || null,
    is_working_day: data ? data.is_working_day : true,
  })
}
