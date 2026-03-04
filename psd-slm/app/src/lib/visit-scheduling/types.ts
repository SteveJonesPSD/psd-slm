// Visit Scheduling Module — Types & Constants

import type { ContractVisitSlotWithDetails } from '@/lib/contracts/types'

// ============================================================
// Database interfaces
// ============================================================

export interface VisitSettings {
  id: string
  org_id: string
  am_default_start: string
  am_default_end: string
  pm_default_start: string
  pm_default_end: string
  created_at: string
  updated_at: string
}

export interface BankHoliday {
  id: string
  org_id: string
  holiday_date: string
  name: string
  created_at: string
}

export interface VisitCalendar {
  id: string
  org_id: string
  name: string
  academic_year_start: string
  academic_year_end: string
  schedule_weeks: number
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VisitCalendarWeek {
  id: string
  calendar_id: string
  week_start_date: string
  cycle_week_number: number | null
  is_holiday: boolean
  holiday_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VisitInstance {
  id: string
  org_id: string
  contract_visit_slot_id: string | null
  calendar_id: string
  calendar_week_id: string | null
  customer_id: string
  customer_contract_id: string | null
  engineer_id: string
  visit_date: string
  time_slot: string
  start_time: string | null
  end_time: string | null
  cycle_week_number: number | null
  status: string
  is_bank_holiday: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  completed_at: string | null
  completed_by: string | null
  cancellation_reason: string | null
  rescheduled_to_date: string | null
  completion_notes: string | null
  notes: string | null
  job_id: string | null
  generated_at: string
  created_at: string
  updated_at: string
}

export interface VisitInstanceWithDetails extends VisitInstance {
  customer_name: string
  engineer_name: string
  engineer_color: string | null
  contract_number: string | null
  job_number: string | null
}

// ============================================================
// Holiday data (for review page overlays)
// ============================================================

export interface HolidayData {
  schoolHolidayWeeks: { week_start_date: string; holiday_name: string | null }[]
  bankHolidays: { holiday_date: string; name: string }[]
}

// ============================================================
// Form / request types
// ============================================================

export interface CalendarFormData {
  name: string
  academic_year_start: string
  academic_year_end: string
  schedule_weeks?: number
  notes?: string | null
}

export interface GenerationRequest {
  calendar_id: string
  engineer_id?: string | null
  month?: number | null   // 1-12 — only generate for weeks starting in this month
  year?: number | null    // e.g. 2026
}

export interface GenerationResult {
  created: number
  skipped: number
  bank_holiday_flagged: number
  errors: string[]
}

// ============================================================
// UI view types
// ============================================================

export interface EngineerWeekView {
  engineer_id: string
  engineer_name: string
  engineer_color: string | null
  days: {
    date: string
    day_of_week: number
    visits: VisitInstanceWithDetails[]
  }[]
}

export interface EngineerMonthView {
  engineer_id: string
  engineer_name: string
  engineer_color: string | null
  visits: VisitInstanceWithDetails[]
}

export interface CycleWeekGrid {
  engineer_id: string
  engineer_name: string
  weeks: {
    cycle_week: number
    days: {
      day_of_week: string
      slots: ContractVisitSlotWithDetails[]
    }[]
  }[]
}

// ============================================================
// Constants
// ============================================================

export const VISIT_STATUSES = ['draft', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'bank_holiday_pending'] as const
export const CALENDAR_STATUSES = ['draft', 'active', 'archived'] as const
export const TIME_SLOTS = ['am', 'pm', 'custom'] as const
export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

export const DAY_NAMES: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
}

export const DAY_SHORT_NAMES: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
}

// Numeric day index (1=Mon..5=Fri) to text key mapping
export const DAY_INDEX_TO_KEY: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
}

export const DAY_KEY_TO_INDEX: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
}

export const TIME_SLOT_LABELS: Record<string, string> = {
  am: 'AM',
  pm: 'PM',
  custom: 'Custom',
}

// Safe date formatting — handles null/undefined/empty values
export function formatVisitDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—'
  // Handle values that already have a time component (don't double-append)
  const dateStr = value.includes('T') ? value : value + 'T00:00:00'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', options || { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getDateYear(value: string | null | undefined): number | null {
  if (!value) return null
  const dateStr = value.includes('T') ? value : value + 'T00:00:00'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.getFullYear()
}

// ProFlex contract types and their default cycle week mappings
export const PROFLEX_CYCLE_DEFAULTS: Record<string, number[]> = {
  proflex_4: [1, 2, 3, 4],
  proflex_3: [1, 2, 3],
  proflex_2: [1, 3],
  proflex_1: [1],
}
