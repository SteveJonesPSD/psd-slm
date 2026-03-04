import type { SlaPlan } from '@/types/database'

interface SlaConfig {
  businessHoursStart: number // minutes from midnight, e.g. 480 = 08:00
  businessHoursEnd: number   // minutes from midnight, e.g. 1050 = 17:30
  businessDays: number[]     // 0=Sun, 1=Mon, ... 6=Sat
  is24x7: boolean
}

function parsePlanConfig(plan: SlaPlan): SlaConfig {
  const [startH, startM] = (plan.business_hours_start || '08:00').split(':').map(Number)
  const [endH, endM] = (plan.business_hours_end || '17:30').split(':').map(Number)
  return {
    businessHoursStart: startH * 60 + startM,
    businessHoursEnd: endH * 60 + endM,
    businessDays: plan.business_days || [1, 2, 3, 4, 5],
    is24x7: plan.is_24x7,
  }
}

function getMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function isBusinessDay(date: Date, config: SlaConfig): boolean {
  return config.businessDays.includes(date.getDay())
}

function isWithinBusinessHours(date: Date, config: SlaConfig): boolean {
  if (config.is24x7) return true
  if (!isBusinessDay(date, config)) return false
  const mins = getMinutesOfDay(date)
  return mins >= config.businessHoursStart && mins < config.businessHoursEnd
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function setMinutesOfDay(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return result
}

/**
 * Calculate SLA deadline given a start time, target minutes, and SLA plan.
 * Respects business hours: skips non-business hours/days.
 * For 24x7 plans, simply adds target minutes.
 */
export function calculateSlaDeadline(
  startTime: Date,
  targetMinutes: number,
  plan: SlaPlan
): Date {
  const config = parsePlanConfig(plan)

  if (config.is24x7) {
    return new Date(startTime.getTime() + targetMinutes * 60_000)
  }

  let remaining = targetMinutes
  let cursor = new Date(startTime)

  // If starting outside business hours, advance to next business start
  if (!isWithinBusinessHours(cursor, config)) {
    cursor = advanceToNextBusinessStart(cursor, config)
  }

  while (remaining > 0) {
    const minutesOfDay = getMinutesOfDay(cursor)
    const minutesLeftToday = config.businessHoursEnd - minutesOfDay

    if (minutesLeftToday <= 0) {
      // End of business day, move to next business day start
      cursor = advanceToNextBusinessStart(addDays(cursor, 1), config)
      continue
    }

    if (remaining <= minutesLeftToday) {
      cursor = new Date(cursor.getTime() + remaining * 60_000)
      remaining = 0
    } else {
      remaining -= minutesLeftToday
      cursor = advanceToNextBusinessStart(addDays(cursor, 1), config)
    }
  }

  return cursor
}

function advanceToNextBusinessStart(date: Date, config: SlaConfig): Date {
  let cursor = setMinutesOfDay(date, config.businessHoursStart)
  // Move forward until we hit a business day
  let safety = 0
  while (!isBusinessDay(cursor, config) && safety < 10) {
    cursor = addDays(cursor, 1)
    cursor = setMinutesOfDay(cursor, config.businessHoursStart)
    safety++
  }
  return cursor
}

/**
 * Calculate elapsed business minutes between two dates respecting the SLA plan.
 */
export function calculateElapsedBusinessMinutes(
  start: Date,
  end: Date,
  plan: SlaPlan
): number {
  const config = parsePlanConfig(plan)

  if (config.is24x7) {
    return Math.floor((end.getTime() - start.getTime()) / 60_000)
  }

  let elapsed = 0
  let cursor = new Date(start)

  if (!isWithinBusinessHours(cursor, config)) {
    cursor = advanceToNextBusinessStart(cursor, config)
  }

  while (cursor < end) {
    if (!isBusinessDay(cursor, config)) {
      cursor = advanceToNextBusinessStart(cursor, config)
      continue
    }

    const minutesOfDay = getMinutesOfDay(cursor)
    if (minutesOfDay < config.businessHoursStart) {
      cursor = setMinutesOfDay(cursor, config.businessHoursStart)
      continue
    }

    const businessEnd = setMinutesOfDay(cursor, config.businessHoursEnd)
    const effectiveEnd = end < businessEnd ? end : businessEnd
    const minutesThisPeriod = Math.floor(
      (effectiveEnd.getTime() - cursor.getTime()) / 60_000
    )

    if (minutesThisPeriod > 0) {
      elapsed += minutesThisPeriod
    }

    cursor = advanceToNextBusinessStart(addDays(cursor, 1), config)
  }

  return elapsed
}

export type SlaStatus = 'on_track' | 'at_risk' | 'breached' | 'met'

/**
 * Get SLA status based on deadline and completion time.
 * at_risk = ≤20% time remaining.
 */
export function getSlaStatus(
  dueAt: string | null,
  completedAt: string | null,
  createdAt?: string
): SlaStatus {
  if (!dueAt) return 'on_track'

  const due = new Date(dueAt)

  if (completedAt) {
    return new Date(completedAt) <= due ? 'met' : 'breached'
  }

  const now = new Date()
  if (now > due) return 'breached'

  // Check if at risk (≤20% of total time remaining)
  if (createdAt) {
    const created = new Date(createdAt)
    const totalMs = due.getTime() - created.getTime()
    const remainingMs = due.getTime() - now.getTime()
    if (totalMs > 0 && remainingMs / totalMs <= 0.2) {
      return 'at_risk'
    }
  }

  return 'on_track'
}

/**
 * Format time remaining in human-readable form.
 * "2h 15m" or "Overdue by 1h 30m"
 */
export function formatTimeRemaining(dueAt: string | null): string {
  if (!dueAt) return '—'

  const due = new Date(dueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const absDiffMs = Math.abs(diffMs)

  const totalMinutes = Math.floor(absDiffMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  let timeStr: string
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    timeStr = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  } else if (hours > 0) {
    timeStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  } else {
    timeStr = `${minutes}m`
  }

  return diffMs < 0 ? `Overdue by ${timeStr}` : timeStr
}
