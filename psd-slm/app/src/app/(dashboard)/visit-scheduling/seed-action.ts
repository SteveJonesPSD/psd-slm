'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function seedVisitScheduling(): Promise<{ error?: string; message?: string }> {
  const user = await requirePermission('visit_scheduling', 'create')
  const supabase = await createClient()

  // Seed default visit settings
  const { error: settingsError } = await supabase
    .from('visit_settings')
    .upsert({
      org_id: user.orgId,
      am_default_start: '09:00',
      am_default_end: '12:00',
      pm_default_start: '13:00',
      pm_default_end: '16:00',
    }, { onConflict: 'org_id' })

  if (settingsError) return { error: `Settings: ${settingsError.message}` }

  // Seed England bank holidays 2025-26 academic year
  const bankHolidays = [
    { holiday_date: '2025-08-25', name: 'Summer Bank Holiday' },
    { holiday_date: '2025-12-25', name: 'Christmas Day' },
    { holiday_date: '2025-12-26', name: 'Boxing Day' },
    { holiday_date: '2026-01-01', name: "New Year's Day" },
    { holiday_date: '2026-04-03', name: 'Good Friday' },
    { holiday_date: '2026-04-06', name: 'Easter Monday' },
    { holiday_date: '2026-05-04', name: 'Early May Bank Holiday' },
    { holiday_date: '2026-05-25', name: 'Spring Bank Holiday' },
    { holiday_date: '2026-08-31', name: 'Summer Bank Holiday' },
  ]

  for (const bh of bankHolidays) {
    await supabase
      .from('bank_holidays')
      .upsert({ org_id: user.orgId, ...bh }, { onConflict: 'org_id,holiday_date' })
  }

  revalidatePath('/visit-scheduling')
  return { message: `Seeded visit settings and ${bankHolidays.length} bank holidays` }
}
