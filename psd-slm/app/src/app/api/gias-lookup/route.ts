import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const urn = searchParams.get('urn')
  const q = searchParams.get('q')

  const supabase = await createClient()

  // Lookup by URN
  if (urn) {
    const { data, error } = await supabase
      .from('gias_schools')
      .select('*')
      .eq('urn', urn)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  }

  // Search by name (type-ahead)
  if (q && q.length >= 2) {
    const { data, error } = await supabase
      .from('gias_schools')
      .select('urn, establishment_name, town, postcode, type_of_establishment')
      .ilike('establishment_name', `%${q}%`)
      .eq('status', 'Open')
      .order('establishment_name')
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Provide ?urn= or ?q= parameter' }, { status: 400 })
}
