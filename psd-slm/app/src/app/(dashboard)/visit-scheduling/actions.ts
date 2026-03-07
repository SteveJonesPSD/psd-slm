'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import type {
  VisitSettings,
  BankHoliday,
  VisitCalendar,
  VisitCalendarWeek,
  VisitInstance,
  VisitInstanceWithDetails,
  GenerationRequest,
  GenerationResult,
  EngineerWeekView,
  EngineerMonthView,
  CycleWeekGrid,
} from '@/lib/visit-scheduling/types'
import { DAY_KEY_TO_INDEX, DAYS_OF_WEEK } from '@/lib/visit-scheduling/types'
import type { ContractVisitSlotWithDetails } from '@/lib/contracts/types'
import { generateJobNumber } from '@/lib/job-utils'

// ============================================================
// Visit Settings
// ============================================================

export async function getVisitSettings(): Promise<VisitSettings | null> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('visit_settings')
    .select('*')
    .eq('org_id', user.orgId)
    .single()

  if (error) return null
  return data
}

export async function updateVisitSettings(formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const payload = {
    am_default_start: (formData.get('am_default_start') as string) || '08:30',
    am_default_end: (formData.get('am_default_end') as string) || '12:00',
    pm_default_start: (formData.get('pm_default_start') as string) || '12:30',
    pm_default_end: (formData.get('pm_default_end') as string) || '16:00',
    updated_at: new Date().toISOString(),
  }

  // Upsert — insert if not exists, update if exists
  const { error } = await supabase
    .from('visit_settings')
    .upsert({
      org_id: user.orgId,
      ...payload,
    }, { onConflict: 'org_id' })

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'visit_settings', entityId: user.orgId, action: 'updated', details: payload })
  revalidatePath('/visit-scheduling')
  return {}
}

// ============================================================
// Bank Holidays
// ============================================================

export async function getBankHolidays(year?: number): Promise<BankHoliday[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  let query = supabase
    .from('bank_holidays')
    .select('*')
    .eq('org_id', user.orgId)
    .order('holiday_date')

  if (year) {
    query = query
      .gte('holiday_date', `${year}-01-01`)
      .lte('holiday_date', `${year}-12-31`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[visit-scheduling] getBankHolidays:', error.message)
    return []
  }
  return data || []
}

export async function addBankHoliday(formData: FormData): Promise<{ error?: string; data?: BankHoliday }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const holiday_date = formData.get('holiday_date') as string
  const name = formData.get('name') as string
  if (!holiday_date || !name?.trim()) return { error: 'Date and name are required' }

  const { data, error } = await supabase
    .from('bank_holidays')
    .insert({
      org_id: user.orgId,
      holiday_date,
      name: name.trim(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'A bank holiday already exists for this date' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'bank_holiday', entityId: data.id, action: 'created', details: { holiday_date, name } })
  revalidatePath('/visit-scheduling')
  return { data }
}

export async function deleteBankHoliday(id: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('bank_holidays')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'bank_holiday', entityId: id, action: 'deleted' })
  revalidatePath('/visit-scheduling')
  return {}
}

// ============================================================
// Holiday data for review pages
// ============================================================

export async function getHolidaysForRange(
  startDate: string,
  endDate: string
): Promise<{ schoolHolidayWeeks: { week_start_date: string; holiday_name: string | null }[]; bankHolidays: { holiday_date: string; name: string }[] }> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  // Get active calendar, then fetch holiday weeks overlapping the range
  const { data: calendar } = await supabase
    .from('visit_calendars')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('status', 'active')
    .limit(1)
    .single()

  let schoolHolidayWeeks: { week_start_date: string; holiday_name: string | null }[] = []
  if (calendar) {
    const { data: weeks } = await supabase
      .from('visit_calendar_weeks')
      .select('week_start_date, holiday_name')
      .eq('calendar_id', calendar.id)
      .eq('is_holiday', true)
      .gte('week_start_date', startDate)
      .lte('week_start_date', endDate)

    schoolHolidayWeeks = weeks || []
  }

  // Fetch bank holidays in the range
  const { data: bankHols } = await supabase
    .from('bank_holidays')
    .select('holiday_date, name')
    .eq('org_id', user.orgId)
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate)
    .order('holiday_date')

  return {
    schoolHolidayWeeks,
    bankHolidays: bankHols || [],
  }
}

// ============================================================
// Calendars
// ============================================================

export async function getCalendars(): Promise<VisitCalendar[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('visit_calendars')
    .select('*')
    .eq('org_id', user.orgId)
    .order('academic_year_start', { ascending: false })

  if (error) {
    console.error('[visit-scheduling] getCalendars:', error.message)
    return []
  }
  return data || []
}

export async function getCalendar(id: string): Promise<VisitCalendar | null> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visit_calendars')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getActiveCalendar(): Promise<VisitCalendar | null> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('visit_calendars')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (error) return null
  return data
}

export async function getCalendarWeeks(calendarId: string): Promise<VisitCalendarWeek[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visit_calendar_weeks')
    .select('*')
    .eq('calendar_id', calendarId)
    .order('sort_order')

  if (error) {
    console.error('[visit-scheduling] getCalendarWeeks:', error.message)
    return []
  }
  return data || []
}

export async function createCalendar(formData: FormData): Promise<{ error?: string; data?: VisitCalendar }> {
  const user = await requirePermission('visit_scheduling', 'create')
  const supabase = await createClient()

  const name = formData.get('name') as string
  const academic_year_start = formData.get('academic_year_start') as string
  const academic_year_end = formData.get('academic_year_end') as string
  const schedule_weeks = Number(formData.get('schedule_weeks') || 39)

  if (!name?.trim() || !academic_year_start || !academic_year_end) {
    return { error: 'Name, start date, and end date are required' }
  }

  // Create calendar
  const { data: calendar, error } = await supabase
    .from('visit_calendars')
    .insert({
      org_id: user.orgId,
      name: name.trim(),
      academic_year_start,
      academic_year_end,
      schedule_weeks,
      notes: (formData.get('notes') as string) || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Generate weeks
  const weeksError = await generateCalendarWeeks(supabase, calendar.id, academic_year_start, academic_year_end, user.orgId)
  if (weeksError) {
    // Rollback calendar
    await supabase.from('visit_calendars').delete().eq('id', calendar.id)
    return { error: weeksError }
  }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: calendar.id, action: 'created', details: { name, academic_year_start, academic_year_end } })
  revalidatePath('/visit-scheduling')
  return { data: calendar }
}

async function generateCalendarWeeks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  calendarId: string,
  startDate: string,
  endDate: string,
  orgId: string
): Promise<string | null> {
  // Get bank holidays for the date range
  const { data: holidays } = await supabase
    .from('bank_holidays')
    .select('holiday_date, name')
    .eq('org_id', orgId)
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate)

  // Build holiday lookup (not used for week-level flagging, but available)
  const _holidayMap = new Map<string, string>()
  ;(holidays || []).forEach(h => _holidayMap.set(h.holiday_date, h.name))

  // Find the Monday of or before start_date
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const firstMonday = new Date(start)
  firstMonday.setDate(firstMonday.getDate() + mondayOffset)

  const weeks: {
    calendar_id: string
    week_start_date: string
    cycle_week_number: number | null
    is_holiday: boolean
    holiday_name: string | null
    sort_order: number
  }[] = []

  let sortOrder = 1
  let cycleWeek = 1
  const current = new Date(firstMonday)

  while (current <= end) {
    const weekStartDate = formatDate(current)

    // Default: not a holiday, user will toggle manually
    const isHoliday = false
    const holidayName = null

    weeks.push({
      calendar_id: calendarId,
      week_start_date: weekStartDate,
      cycle_week_number: isHoliday ? null : cycleWeek,
      is_holiday: isHoliday,
      holiday_name: holidayName,
      sort_order: sortOrder,
    })

    if (!isHoliday) {
      cycleWeek = (cycleWeek % 4) + 1
    }

    sortOrder++
    current.setDate(current.getDate() + 7)
  }

  if (weeks.length === 0) return 'No weeks generated — check date range'

  const { error } = await supabase
    .from('visit_calendar_weeks')
    .insert(weeks)

  if (error) return error.message
  return null
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function updateCalendar(id: string, formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const name = formData.get('name') as string
  if (name) payload.name = name.trim()
  const notes = formData.get('notes') as string
  if (notes !== null) payload.notes = notes || null

  const { error } = await supabase
    .from('visit_calendars')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: id, action: 'updated', details: payload })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function activateCalendar(id: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  // Activate this calendar (multiple active calendars are allowed)
  const { error } = await supabase
    .from('visit_calendars')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: id, action: 'activated' })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function archiveCalendar(id: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('visit_calendars')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: id, action: 'archived' })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function deleteCalendar(id: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'delete')
  const supabase = await createClient()

  // Check for generated visit instances
  const { count } = await supabase
    .from('visit_instances')
    .select('id', { count: 'exact', head: true })
    .eq('calendar_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} generated visit(s) exist. Archive the calendar instead.` }
  }

  // Delete weeks first (cascade should handle this, but be explicit)
  await supabase.from('visit_calendar_weeks').delete().eq('calendar_id', id)

  const { error } = await supabase
    .from('visit_calendars')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: id, action: 'deleted' })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function updateCalendarWeek(
  weekId: string,
  updates: { is_holiday?: boolean; is_extra?: boolean; holiday_name?: string | null }
): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('visit_calendar_weeks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', weekId)

  if (error) return { error: error.message }

  revalidatePath('/visit-scheduling')
  return {}
}

export async function bulkUpdateHolidays(
  calendarId: string,
  weekIds: string[],
  isHoliday: boolean,
  holidayName?: string
): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('visit_calendar_weeks')
    .update({
      is_holiday: isHoliday,
      holiday_name: isHoliday ? (holidayName || 'School Holiday') : null,
      updated_at: new Date().toISOString(),
    })
    .in('id', weekIds)

  if (error) return { error: error.message }

  // Recalculate cycle numbers after toggling holidays
  const recalcError = await recalculateCycleNumbers(calendarId)
  if (recalcError) return { error: recalcError }

  logActivity({ supabase, user, entityType: 'visit_calendar', entityId: calendarId, action: 'holidays_updated', details: { weekCount: weekIds.length, isHoliday } })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function recalculateCycleNumbers(calendarId: string): Promise<string | null> {
  await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  // Always 4-week cycle
  const cycleLength = 4

  // Get all weeks ordered
  const { data: weeks, error } = await supabase
    .from('visit_calendar_weeks')
    .select('id, is_holiday, is_extra, sort_order')
    .eq('calendar_id', calendarId)
    .order('sort_order')

  if (error) return error.message
  if (!weeks) return null

  let cycleWeek = 1
  const updates: { id: string; cycle_week_number: number | null }[] = []

  for (const week of weeks) {
    if (week.is_holiday || week.is_extra) {
      // Holiday and extra weeks don't participate in cycle rotation
      updates.push({ id: week.id, cycle_week_number: null })
    } else {
      updates.push({ id: week.id, cycle_week_number: cycleWeek })
      cycleWeek = (cycleWeek % cycleLength) + 1
    }
  }

  // Batch update
  for (const u of updates) {
    await supabase
      .from('visit_calendar_weeks')
      .update({ cycle_week_number: u.cycle_week_number, updated_at: new Date().toISOString() })
      .eq('id', u.id)
  }

  return null
}

export async function getEngineerCycleGrid(engineerId: string): Promise<CycleWeekGrid> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  // Get engineer info
  const { data: engineer } = await supabase
    .from('users')
    .select('id, first_name, last_name, color')
    .eq('id', engineerId)
    .single()

  // Get all visit slots for this engineer from contract_visit_slots (via the contracts view)
  const { data: slotRows } = await supabase
    .from('v_contract_visit_slots')
    .select('*')
    .eq('engineer_id', engineerId)

  const slots: ContractVisitSlotWithDetails[] = (slotRows || []).map((row: Record<string, unknown>) => row as unknown as ContractVisitSlotWithDetails)

  // Build cycle week grid (always 4-week cycle)
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const cycleWeek = i + 1
    const days = DAYS_OF_WEEK.map(dayKey => ({
      day_of_week: dayKey,
      slots: slots.filter(s =>
        s.day_of_week === dayKey &&
        s.cycle_week_numbers.includes(cycleWeek)
      ),
    }))
    return { cycle_week: cycleWeek, days }
  })

  return {
    engineer_id: engineerId,
    engineer_name: engineer ? `${engineer.first_name} ${engineer.last_name}` : '',
    weeks,
  }
}

export async function getFieldEngineers(): Promise<{ id: string; first_name: string; last_name: string; initials: string | null; color: string | null; avatar_url: string | null }[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  // Use same pattern as scheduling module — look for infrastructure/engineering teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .in('slug', ['infrastructure', 'engineering'])

  const teamIds = teams?.map(t => t.id) || []

  if (teamIds.length === 0) {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, initials, color, avatar_url')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .order('first_name')
    return data || []
  }

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .in('team_id', teamIds)

  const userIds = [...new Set((members || []).map(m => m.user_id))]
  if (userIds.length === 0) {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, initials, color, avatar_url')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .order('first_name')
    return data || []
  }

  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color, avatar_url')
    .in('id', userIds)
    .eq('is_active', true)
    .order('first_name')

  return data || []
}

// ============================================================
// Visit Generation
// ============================================================

export async function generateVisits(request: GenerationRequest): Promise<GenerationResult> {
  const user = await requirePermission('visit_scheduling', 'create')
  const supabase = await createClient()

  const result: GenerationResult = {
    created: 0,
    skipped: 0,
    bank_holiday_flagged: 0,
    errors: [],
  }

  // Get calendar with weeks
  const { data: calendar } = await supabase
    .from('visit_calendars')
    .select('*')
    .eq('id', request.calendar_id)
    .single()

  if (!calendar) {
    result.errors.push('Calendar not found')
    return result
  }

  // Get all non-holiday weeks
  const { data: allWeeks } = await supabase
    .from('visit_calendar_weeks')
    .select('*')
    .eq('calendar_id', request.calendar_id)
    .order('sort_order')

  if (!allWeeks || allWeeks.length === 0) {
    result.errors.push('No weeks found for this calendar')
    return result
  }

  // Filter weeks by month if specified
  let weeks = allWeeks
  if (request.month && request.year) {
    weeks = allWeeks.filter(w => {
      const d = new Date(w.week_start_date + 'T00:00:00')
      return d.getMonth() + 1 === request.month && d.getFullYear() === request.year
    })
    if (weeks.length === 0) {
      result.errors.push('No calendar weeks fall in the selected month')
      return result
    }
  }

  // Get contract visit slots — only for contracts assigned to this calendar
  let slotsQuery = supabase
    .from('v_contract_visit_slots')
    .select('*')
    .eq('calendar_id', request.calendar_id)

  if (request.engineer_id) {
    slotsQuery = slotsQuery.eq('engineer_id', request.engineer_id)
  }

  const { data: slotRows } = await slotsQuery
  if (!slotRows || slotRows.length === 0) {
    result.errors.push('No contract visit slots found for this calendar. Assign contracts to this calendar and add visit slots first.')
    return result
  }

  // Get bank holidays
  const { data: bankHolidays } = await supabase
    .from('bank_holidays')
    .select('holiday_date')
    .eq('org_id', user.orgId)
    .gte('holiday_date', calendar.academic_year_start)
    .lte('holiday_date', calendar.academic_year_end)

  const bankHolidayDates = new Set((bankHolidays || []).map(h => h.holiday_date))

  // Get visit settings for default times
  const settings = await getVisitSettings()

  // Get existing visits to avoid duplicates
  const { data: existingVisits } = await supabase
    .from('visit_instances')
    .select('contract_visit_slot_id, visit_date')
    .eq('calendar_id', request.calendar_id)
    .not('status', 'eq', 'cancelled')

  const existingSet = new Set(
    (existingVisits || []).map(v => `${v.contract_visit_slot_id}:${v.visit_date}`)
  )

  // Generate visits
  const visitsToInsert: Record<string, unknown>[] = []

  for (const week of weeks) {
    if (week.is_holiday) continue // Skip school holiday weeks

    const isExtraWeek = week.is_extra

    // Normal weeks need a cycle number; extra weeks are scheduled for all slots
    if (!isExtraWeek && week.cycle_week_number === null) continue

    for (const slot of slotRows) {
      // Extra weeks: schedule all slots. Normal weeks: check cycle match.
      if (!isExtraWeek) {
        const cycleWeeks = slot.cycle_week_numbers as number[]
        if (!cycleWeeks.includes(week.cycle_week_number!)) continue
      }

      // Calculate the actual date from week_start_date + day_of_week
      const dayIndex = DAY_KEY_TO_INDEX[slot.day_of_week as string] || 1
      const weekStart = new Date(week.week_start_date + 'T00:00:00')
      const visitDate = new Date(weekStart)
      visitDate.setDate(visitDate.getDate() + (dayIndex - 1))
      const dateStr = formatDate(visitDate)

      // Skip if already exists
      const key = `${slot.id}:${dateStr}`
      if (existingSet.has(key)) {
        result.skipped++
        continue
      }

      // Determine times: override > default > settings
      let start_time = (slot.override_start_time || slot.default_start_time) as string | null
      let end_time = (slot.override_end_time || slot.default_end_time) as string | null
      if (!start_time && settings) {
        const timeSlot = slot.time_slot as string
        if (timeSlot === 'am') {
          start_time = settings.am_default_start
          end_time = settings.am_default_end
        } else if (timeSlot === 'pm') {
          start_time = settings.pm_default_start
          end_time = settings.pm_default_end
        } else {
          start_time = settings.am_default_start
          end_time = settings.pm_default_end
        }
      }

      const isBankHoliday = bankHolidayDates.has(dateStr)
      if (isBankHoliday) result.bank_holiday_flagged++

      visitsToInsert.push({
        org_id: user.orgId,
        contract_visit_slot_id: slot.id,
        calendar_id: request.calendar_id,
        calendar_week_id: week.id,
        customer_id: slot.customer_id,
        customer_contract_id: slot.customer_contract_id,
        engineer_id: slot.engineer_id,
        visit_date: dateStr,
        time_slot: slot.time_slot,
        start_time,
        end_time,
        cycle_week_number: week.cycle_week_number,
        status: isBankHoliday ? 'bank_holiday_pending' : 'draft',
        is_bank_holiday: isBankHoliday,
      })
    }
  }

  // Insert in batches of 100
  for (let i = 0; i < visitsToInsert.length; i += 100) {
    const batch = visitsToInsert.slice(i, i + 100)
    const { error } = await supabase.from('visit_instances').insert(batch)
    if (error) {
      result.errors.push(`Batch ${Math.floor(i / 100) + 1}: ${error.message}`)
    } else {
      result.created += batch.length
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'visit_calendar',
    entityId: request.calendar_id,
    action: 'visits_generated',
    details: { created: result.created, skipped: result.skipped, bank_holiday_flagged: result.bank_holiday_flagged },
  })
  revalidatePath('/visit-scheduling')
  return result
}

// ============================================================
// Visit Instances — Read
// ============================================================

export async function getEngineerVisits(
  engineerId: string,
  startDate: string,
  endDate: string
): Promise<VisitInstanceWithDetails[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visit_instances')
    .select(`
      *,
      customers(name),
      users!visit_instances_engineer_id_fkey(first_name, last_name, color),
      customer_contracts(contract_number)
    `)
    .eq('engineer_id', engineerId)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)
    .order('visit_date')
    .order('start_time')

  if (error) {
    console.error('[visit-scheduling] getEngineerVisits:', error.message)
    return []
  }

  const visits = (data || []).map(mapVisitRow)
  return enrichWithJobNumbers(supabase, visits)
}

export async function getEngineerWeekView(
  engineerIds: string[],
  weekStart: string
): Promise<EngineerWeekView[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  // Calculate week end (Friday)
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 4)
  const weekEnd = formatDate(end)

  // Get all visits for these engineers in this week
  const { data: visits, error } = await supabase
    .from('visit_instances')
    .select(`
      *,
      customers(name),
      users!visit_instances_engineer_id_fkey(first_name, last_name, color),
      customer_contracts(contract_number)
    `)
    .in('engineer_id', engineerIds)
    .gte('visit_date', weekStart)
    .lte('visit_date', weekEnd)
    .not('status', 'eq', 'cancelled')
    .order('visit_date')
    .order('start_time')

  if (error) {
    console.error('[visit-scheduling] getEngineerWeekView:', error.message)
    return []
  }

  // Get engineer details
  const { data: engineers } = await supabase
    .from('users')
    .select('id, first_name, last_name, color')
    .in('id', engineerIds)
    .order('first_name')

  const mappedVisits = await enrichWithJobNumbers(supabase, (visits || []).map(mapVisitRow))

  return (engineers || []).map(eng => {
    const days = [0, 1, 2, 3, 4].map(offset => {
      const d = new Date(start)
      d.setDate(d.getDate() + offset)
      const dateStr = formatDate(d)
      return {
        date: dateStr,
        day_of_week: offset + 1,
        visits: mappedVisits.filter(v => v.engineer_id === eng.id && v.visit_date === dateStr),
      }
    })
    return {
      engineer_id: eng.id,
      engineer_name: `${eng.first_name} ${eng.last_name}`,
      engineer_color: eng.color,
      days,
    }
  })
}

export async function getEngineerMonthView(
  engineerIds: string[],
  year: number,
  month: number
): Promise<EngineerMonthView[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: visits, error } = await supabase
    .from('visit_instances')
    .select(`
      *,
      customers(name),
      users!visit_instances_engineer_id_fkey(first_name, last_name, color),
      customer_contracts(contract_number)
    `)
    .in('engineer_id', engineerIds)
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd)
    .not('status', 'eq', 'cancelled')
    .order('visit_date')
    .order('start_time')

  if (error) {
    console.error('[visit-scheduling] getEngineerMonthView:', error.message)
    return []
  }

  const { data: engineers } = await supabase
    .from('users')
    .select('id, first_name, last_name, color')
    .in('id', engineerIds)
    .order('first_name')

  const mappedVisits = await enrichWithJobNumbers(supabase, (visits || []).map(mapVisitRow))

  return (engineers || []).map(eng => ({
    engineer_id: eng.id,
    engineer_name: `${eng.first_name} ${eng.last_name}`,
    engineer_color: eng.color,
    visits: mappedVisits.filter(v => v.engineer_id === eng.id),
  }))
}

export async function confirmEngineerMonthVisits(
  engineerId: string,
  year: number,
  month: number
): Promise<{ error?: string; count?: number; jobsCreated?: number }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('visit_instances')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('engineer_id', engineerId)
    .eq('status', 'draft')
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd)
    .select('id')

  if (error) return { error: error.message }

  const confirmedCount = data?.length || 0

  let jobsCreated = 0
  if (confirmedCount > 0) {
    const confirmedIds = data!.map(v => v.id)
    const { data: visits } = await supabase
      .from('visit_instances')
      .select(`
        *,
        customers(name),
        customer_contracts(contract_number, contract_type_id, contract_types(name))
      `)
      .in('id', confirmedIds)
      .is('job_id', null)

    if (visits && visits.length > 0) {
      const visitJobTypeId = await getOrCreateVisitJobType(supabase, user.orgId)
      for (const visit of visits) {
        const created = await createJobForVisit(supabase, user, visit, visitJobTypeId)
        if (created) jobsCreated++
      }
    }
  }

  logActivity({ supabase, user, entityType: 'visit_instance', entityId: engineerId, action: 'month_confirmed', details: { year, month, count: confirmedCount, jobsCreated } })
  revalidatePath('/visit-scheduling')
  revalidatePath('/scheduling')
  return { count: confirmedCount, jobsCreated }
}

export async function getVisitStats(): Promise<{
  todayCount: number
  weekCount: number
  unconfirmedCount: number
  bankHolidayPending: number
}> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()
  const user = await requireAuth()

  const today = formatDate(new Date())
  const start = new Date()
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  start.setDate(start.getDate() + mondayOffset)
  const weekStart = formatDate(start)
  const friday = new Date(start)
  friday.setDate(friday.getDate() + 4)
  const weekEnd = formatDate(friday)

  const { data: visits } = await supabase
    .from('visit_instances')
    .select('visit_date, status, is_bank_holiday')
    .eq('org_id', user.orgId)
    .gte('visit_date', weekStart)
    .not('status', 'in', '(cancelled,rescheduled)')

  const all = visits || []

  return {
    todayCount: all.filter(v => v.visit_date === today).length,
    weekCount: all.filter(v => v.visit_date >= weekStart && v.visit_date <= weekEnd).length,
    unconfirmedCount: all.filter(v => v.status === 'draft').length,
    bankHolidayPending: all.filter(v => v.status === 'bank_holiday_pending').length,
  }
}

export async function getCompanyVisits(
  customerId: string,
  limit: number = 20
): Promise<VisitInstanceWithDetails[]> {
  await requirePermission('visit_scheduling', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visit_instances')
    .select(`
      *,
      customers(name),
      users!visit_instances_engineer_id_fkey(first_name, last_name, color),
      customer_contracts(contract_number)
    `)
    .eq('customer_id', customerId)
    .not('status', 'eq', 'cancelled')
    .order('visit_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[visit-scheduling] getCompanyVisits:', error.message)
    return []
  }

  const visits = (data || []).map(mapVisitRow)
  return enrichWithJobNumbers(supabase, visits)
}

// ============================================================
// Visit Instances — Mutations
// ============================================================

export async function confirmEngineerVisits(
  engineerId: string,
  weekStart: string
): Promise<{ error?: string; count?: number; jobsCreated?: number }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const end = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 4)
  const weekEnd = formatDate(end)

  const { data, error } = await supabase
    .from('visit_instances')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('engineer_id', engineerId)
    .eq('status', 'draft')
    .gte('visit_date', weekStart)
    .lte('visit_date', weekEnd)
    .select('id')

  if (error) return { error: error.message }

  const confirmedCount = data?.length || 0

  // Create jobs for confirmed visits that don't have one yet
  let jobsCreated = 0
  if (confirmedCount > 0) {
    const confirmedIds = data!.map(v => v.id)
    const { data: visits } = await supabase
      .from('visit_instances')
      .select(`
        *,
        customers(name),
        customer_contracts(contract_number, contract_type_id, contract_types(name))
      `)
      .in('id', confirmedIds)
      .is('job_id', null)

    if (visits && visits.length > 0) {
      const visitJobTypeId = await getOrCreateVisitJobType(supabase, user.orgId)
      for (const visit of visits) {
        const created = await createJobForVisit(supabase, user, visit, visitJobTypeId)
        if (created) jobsCreated++
      }
    }
  }

  logActivity({ supabase, user, entityType: 'visit_instance', entityId: engineerId, action: 'bulk_confirmed', details: { weekStart, count: confirmedCount, jobsCreated } })
  revalidatePath('/visit-scheduling')
  revalidatePath('/scheduling')
  return { count: confirmedCount, jobsCreated }
}

export async function cancelVisit(id: string, reason?: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  // Fetch visit to check for linked job
  const { data: visit } = await supabase
    .from('visit_instances')
    .select('job_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('visit_instances')
    .update({
      status: 'cancelled',
      cancellation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Cancel linked job if it exists and isn't already completed/cancelled
  if (visit?.job_id) {
    await supabase
      .from('jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || 'Visit cancelled',
      })
      .eq('id', visit.job_id)
      .not('status', 'in', '(completed,cancelled)')
    revalidatePath('/scheduling')
  }

  logActivity({ supabase, user, entityType: 'visit_instance', entityId: id, action: 'cancelled', details: { reason } })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function rescheduleVisit(
  id: string,
  newDate: string,
  newTimeSlot?: string,
  newStartTime?: string,
  newEndTime?: string
): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  // Fetch existing visit before updating (need job_id and fields for replacement)
  const { data: existing } = await supabase
    .from('visit_instances')
    .select('*')
    .eq('id', id)
    .single()

  // Mark original as rescheduled with new date
  const { error } = await supabase
    .from('visit_instances')
    .update({
      status: 'rescheduled',
      rescheduled_to_date: newDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Cancel linked job on original visit (replacement gets its own on confirmation)
  if (existing?.job_id) {
    await supabase
      .from('jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'Visit rescheduled',
      })
      .eq('id', existing.job_id)
      .not('status', 'in', '(completed,cancelled)')
    revalidatePath('/scheduling')
  }

  if (existing) {
    // Create a new visit on the new date (no job_id — gets created on confirmation)
    await supabase
      .from('visit_instances')
      .insert({
        org_id: existing.org_id,
        contract_visit_slot_id: existing.contract_visit_slot_id,
        calendar_id: existing.calendar_id,
        customer_id: existing.customer_id,
        customer_contract_id: existing.customer_contract_id,
        engineer_id: existing.engineer_id,
        visit_date: newDate,
        time_slot: newTimeSlot || existing.time_slot,
        start_time: newStartTime || existing.start_time,
        end_time: newEndTime || existing.end_time,
        cycle_week_number: existing.cycle_week_number,
        status: 'draft',
      })
  }

  logActivity({ supabase, user, entityType: 'visit_instance', entityId: id, action: 'rescheduled', details: { newDate } })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function completeVisit(id: string, completionNotes?: string): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  // Fetch visit to check for linked job
  const { data: visit } = await supabase
    .from('visit_instances')
    .select('job_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('visit_instances')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      completion_notes: completionNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Complete linked job (lightweight — no task/signature enforcement for visit-sourced jobs)
  if (visit?.job_id) {
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes || 'Completed via visit scheduling',
      })
      .eq('id', visit.job_id)
      .not('status', 'in', '(completed,cancelled)')
    revalidatePath('/scheduling')
  }

  logActivity({ supabase, user, entityType: 'visit_instance', entityId: id, action: 'completed' })
  revalidatePath('/visit-scheduling')
  return {}
}

export async function updateVisitTimes(
  id: string,
  startTime: string,
  endTime: string
): Promise<{ error?: string }> {
  const user = await requirePermission('visit_scheduling', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('visit_instances')
    .update({
      start_time: startTime,
      end_time: endTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/visit-scheduling')
  return {}
}

// ============================================================
// Visit → Job Bridge Helpers
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateVisitJobType(supabase: any, orgId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('job_types')
    .select('id')
    .eq('org_id', orgId)
    .eq('slug', 'visit')
    .single()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('job_types')
    .insert({
      org_id: orgId,
      name: 'Visit',
      slug: 'visit',
      color: '#6366f1', // indigo
      default_duration_minutes: 210,
    })
    .select('id')
    .single()

  return created!.id
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createJobForVisit(supabase: any, user: any, visit: any, jobTypeId: string): Promise<boolean> {
  // Skip if already linked
  if (visit.job_id) return false

  const customer = visit.customers as { name: string } | null
  const contract = visit.customer_contracts as { contract_number: string; contract_types?: { name: string } | null } | null
  const contractTypeName = contract?.contract_types?.name || 'Scheduled'

  const jobNumber = await generateJobNumber(supabase, user.orgId)
  const title = `${contractTypeName} Visit — ${customer?.name || 'Customer'}`

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      org_id: user.orgId,
      job_number: jobNumber,
      title,
      company_id: visit.customer_id,
      job_type_id: jobTypeId,
      priority: 'normal',
      status: 'scheduled',
      assigned_to: visit.engineer_id,
      scheduled_date: visit.visit_date,
      scheduled_time: visit.start_time || null,
      estimated_duration_minutes: 210,
      source_type: 'visit',
      source_id: visit.id,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[visit-job-bridge] createJobForVisit failed:', error.message)
    return false
  }

  // Link job back to visit
  await supabase
    .from('visit_instances')
    .update({ job_id: job.id, updated_at: new Date().toISOString() })
    .eq('id', visit.id)

  return true
}

// ============================================================
// Helpers
// ============================================================

function mapVisitRow(row: Record<string, unknown>): VisitInstanceWithDetails {
  const customer = row.customers as { name: string } | null
  const engineer = row.users as { first_name: string; last_name: string; color: string | null } | null
  const contract = row.customer_contracts as { contract_number: string } | null

  return {
    ...(row as unknown as VisitInstance),
    customer_name: customer?.name || '',
    engineer_name: engineer ? `${engineer.first_name} ${engineer.last_name}` : '',
    engineer_color: engineer?.color || null,
    contract_number: contract?.contract_number || null,
    job_number: null,
  }
}

// Enrich visits with job numbers (separate query to avoid breaking if migration not yet applied)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichWithJobNumbers(supabase: any, visits: VisitInstanceWithDetails[]): Promise<VisitInstanceWithDetails[]> {
  const jobIds = visits.map(v => v.job_id).filter(Boolean) as string[]
  if (jobIds.length === 0) return visits

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number')
    .in('id', jobIds)

  if (!jobs || jobs.length === 0) return visits

  const jobMap = new Map<string, string>(jobs.map((j: { id: string; job_number: string }) => [j.id, j.job_number]))
  return visits.map(v => ({
    ...v,
    job_number: (v.job_id && jobMap.get(v.job_id)) || null,
  }))
}
