import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER } from '@/lib/margin'

export interface MarginThresholds {
  green: number
  amber: number
}

export async function getMarginThresholds(): Promise<MarginThresholds> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .eq('category', 'general')
    .in('setting_key', ['margin_threshold_green', 'margin_threshold_amber'])

  let green = DEFAULT_MARGIN_GREEN
  let amber = DEFAULT_MARGIN_AMBER

  for (const row of data || []) {
    const val = parseFloat(row.setting_value as string)
    if (isNaN(val)) continue
    if (row.setting_key === 'margin_threshold_green') green = val
    if (row.setting_key === 'margin_threshold_amber') amber = val
  }

  return { green, amber }
}
