import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processAutoClose } from '@/lib/helpdesk/auto-close'

export async function GET() {
  try {
    // Authenticate via session cookie
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org_id from app user
    const { data: appUser } = await supabase
      .from('users')
      .select('org_id')
      .eq('auth_id', authUser.id)
      .eq('is_active', true)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Use admin client to bypass RLS for cross-ticket operations
    const adminClient = createAdminClient()
    const result = await processAutoClose(adminClient, appUser.org_id)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Auto-close processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
