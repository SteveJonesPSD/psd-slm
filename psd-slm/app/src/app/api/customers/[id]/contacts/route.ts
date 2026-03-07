import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { decryptContactRows } from '@/lib/crypto-helpers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, is_primary, job_title')
    .eq('customer_id', id)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('first_name')

  return NextResponse.json({ contacts: decryptContactRows(data || []) })
}
