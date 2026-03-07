export type ConflictType = 'time_overlap' | 'no_travel_gap' | 'annual_leave' | 'training' | 'other_non_job'

export interface JobConflict {
  conflictingJobId: string
  conflictingJobNumber: string
  conflictType: ConflictType
  conflictingStart: string       // ISO timestamp
  conflictingEnd: string         // ISO timestamp
  jobTypeName: string
  customerName: string | null
  address: string | null
  isHardBlock: boolean           // true = annual leave, never suggest override
}

export interface ActivityConflict {
  conflictingActivityId: string
  conflictingTitle: string
  conflictType: ConflictType
  conflictingStart: string
  conflictingEnd: string
  activityTypeName: string
  isAllDay: boolean
  isHardBlock: boolean
}

export type ScheduleConflict = (JobConflict & { source: 'job' }) | (ActivityConflict & { source: 'activity' })

export interface ConflictCheckInput {
  engineerId: string
  proposedStart: string          // ISO timestamp
  proposedEnd: string            // ISO timestamp
  excludeJobId?: string          // for edits - exclude the job being edited
}

export interface SmartScheduleInput {
  engineerId: string
  conflictEnd: string            // ISO end time of the conflicting item
  conflictAddress: string | null // address of the conflicting item
  proposedJobAddress: string
  proposedJobDurationMinutes: number
  targetDate: string             // YYYY-MM-DD
}

export interface SmartScheduleSuggestion {
  engineerId: string
  engineerName: string
  suggestedStart: string | null  // ISO timestamp, null if not possible
  suggestedEnd: string | null
  travelDurationMinutes: number | null
  feasible: boolean
  reason: 'ok' | 'after_eod' | 'end_overruns_eod' | 'no_route' | 'hard_block'
  reasonDetail: string
  overridable: boolean
}

export interface TeamMemberAvailability {
  engineerId: string
  engineerName: string
  hasConflict: boolean
  conflictIsHardBlock: boolean
  suggestion: SmartScheduleSuggestion | null
}

/**
 * Derive the conflict type from a job type slug or name.
 */
export function deriveConflictType(slug: string | null, name: string): ConflictType {
  const s = (slug || '').toLowerCase()
  const n = name.toLowerCase()

  if (s === 'annual-leave' || n.includes('annual leave') || s === 'leave-holiday' || n.includes('holiday')) {
    return 'annual_leave'
  }
  if (s.includes('training') || n.includes('training')) {
    return 'training'
  }
  return 'time_overlap'
}

/**
 * Derive the conflict type from an activity type slug or name.
 */
export function deriveActivityConflictType(slug: string | null, name: string): ConflictType {
  const s = (slug || '').toLowerCase()
  const n = name.toLowerCase()

  if (s === 'annual-leave' || s === 'leave-holiday' || n.includes('annual leave') || n.includes('holiday') || n.includes('leave')) {
    return 'annual_leave'
  }
  if (s.includes('training') || n.includes('training')) {
    return 'training'
  }
  return 'other_non_job'
}

/**
 * Format a full address from components.
 */
export function formatAddress(line1?: string | null, line2?: string | null, city?: string | null, postcode?: string | null): string | null {
  const parts = [line1, line2, city, postcode].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}
