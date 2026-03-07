import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateTravelTime, clearGeocodeCache, geocodeAddressCached, getDrivingTime } from '@/lib/scheduling/travel'
import { deriveConflictType, deriveActivityConflictType, formatAddress } from '@/lib/scheduling/conflict'
import type { SmartScheduleSuggestion, TeamMemberAvailability } from '@/lib/scheduling/conflict'

interface RequestBody {
  engineerId: string
  conflictEnd: string
  conflictAddress: string | null
  proposedJobAddress: string
  proposedJobDurationMinutes: number
  targetDate: string
  includeTeam: boolean
  proposedStart?: string
  proposedEnd?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSchedulingSettings(supabase: any, orgId: string) {
  const { data: settings, error } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'scheduling')
    .in('setting_key', ['working_day_start', 'working_day_end', 'travel_buffer_minutes'])

  let workingDayStart = '08:00'
  let workingDayEnd = '17:30'
  let travelBufferMinutes = 15

  if (error) {
    console.warn('[smart-schedule] Settings query error:', error.message)
    return { workingDayStart, workingDayEnd, travelBufferMinutes }
  }

  if (settings) {
    for (const s of settings) {
      try {
        if (s.setting_key === 'working_day_start') {
          workingDayStart = JSON.parse(s.setting_value)
        } else if (s.setting_key === 'working_day_end') {
          workingDayEnd = JSON.parse(s.setting_value)
        } else if (s.setting_key === 'travel_buffer_minutes') {
          travelBufferMinutes = parseInt(JSON.parse(s.setting_value)) || 15
        }
      } catch {
        console.warn('[smart-schedule] Failed to parse setting:', s.setting_key, s.setting_value)
      }
    }
  }

  return { workingDayStart, workingDayEnd, travelBufferMinutes }
}

/**
 * Get effective working day end for a specific engineer on a given date.
 * Checks user_working_hours for individual overrides, falls back to org default.
 * Returns { isWorkingDay, startTime, endTime }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEffectiveHoursForEngineer(
  supabase: any,
  orgId: string,
  engineerId: string,
  targetDate: string,
  orgStart: string,
  orgEnd: string,
): Promise<{ isWorkingDay: boolean; startTime: string; endTime: string }> {
  // Get ISO day of week
  const d = new Date(targetDate + 'T12:00:00')
  const jsDay = d.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay

  const { data: userHours } = await supabase
    .from('user_working_hours')
    .select('is_working_day, start_time, end_time')
    .eq('user_id', engineerId)
    .eq('day_of_week', isoDay)
    .maybeSingle()

  if (userHours) {
    if (!userHours.is_working_day) {
      return { isWorkingDay: false, startTime: orgStart, endTime: orgEnd }
    }
    return {
      isWorkingDay: true,
      startTime: userHours.start_time || orgStart,
      endTime: userHours.end_time || orgEnd,
    }
  }

  // Check org working days
  const { data: orgDaysSetting } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', orgId)
    .eq('setting_key', 'scheduling_working_days')
    .maybeSingle()

  let orgDays = [1, 2, 3, 4, 5]
  if (orgDaysSetting?.setting_value) {
    try { orgDays = JSON.parse(orgDaysSetting.setting_value) } catch { /* skip */ }
  }

  return {
    isWorkingDay: orgDays.includes(isoDay),
    startTime: orgStart,
    endTime: orgEnd,
  }
}

async function computeSuggestion(
  conflictEnd: string,
  conflictAddress: string | null,
  proposedJobAddress: string,
  proposedJobDurationMinutes: number,
  targetDate: string,
  workingDayEnd: string,
  travelBufferMinutes: number,
  engineerId: string,
  engineerName: string,
): Promise<SmartScheduleSuggestion> {
  // Calculate travel time if both addresses available
  let travelMinutes: number | null = null
  let routeFound = false

  if (conflictAddress && proposedJobAddress) {
    console.log('[smart-schedule] Travel estimate from:', conflictAddress, 'to:', proposedJobAddress)
    try {
      const travel = await estimateTravelTime(conflictAddress, proposedJobAddress)
      console.log('[smart-schedule] Travel result:', JSON.stringify(travel))
      if (travel.routeFound) {
        travelMinutes = travel.durationMinutes
        routeFound = true
      }
    } catch (err) {
      console.warn('[smart-schedule] Travel estimation failed:', err)
    }
  } else {
    console.log('[smart-schedule] Missing address — conflict:', conflictAddress, 'proposed:', proposedJobAddress)
  }

  const conflictEndDate = new Date(conflictEnd)
  const totalBuffer = (travelMinutes || 0) + travelBufferMinutes
  const suggestedStartDate = new Date(conflictEndDate.getTime() + totalBuffer * 60000)
  const suggestedEndDate = new Date(suggestedStartDate.getTime() + proposedJobDurationMinutes * 60000)

  // Parse working day end
  const [eodH, eodM] = workingDayEnd.split(':').map(Number)
  const eodDate = new Date(`${targetDate}T${String(eodH).padStart(2, '0')}:${String(eodM).padStart(2, '0')}:00`)

  const formatTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (!routeFound && conflictAddress && proposedJobAddress) {
    return {
      engineerId,
      engineerName,
      suggestedStart: suggestedStartDate.toISOString(),
      suggestedEnd: suggestedEndDate.toISOString(),
      travelDurationMinutes: null,
      feasible: true,
      reason: 'no_route',
      reasonDetail: `Could not calculate a route between locations. Travel time estimate unavailable. Suggested start: ${formatTime(suggestedStartDate)} (based on buffer only).`,
      overridable: true,
    }
  }

  if (suggestedStartDate > eodDate) {
    return {
      engineerId,
      engineerName,
      suggestedStart: suggestedStartDate.toISOString(),
      suggestedEnd: suggestedEndDate.toISOString(),
      travelDurationMinutes: travelMinutes,
      feasible: false,
      reason: 'after_eod',
      reasonDetail: travelMinutes !== null
        ? `Travel from previous job estimated at ${travelMinutes} mins (+${travelBufferMinutes} min buffer). Earliest arrival: ${formatTime(suggestedStartDate)}. This would be after the end of the working day (${workingDayEnd}).`
        : `Earliest available start: ${formatTime(suggestedStartDate)}. This would be after the end of the working day (${workingDayEnd}).`,
      overridable: true,
    }
  }

  if (suggestedEndDate > eodDate) {
    return {
      engineerId,
      engineerName,
      suggestedStart: suggestedStartDate.toISOString(),
      suggestedEnd: suggestedEndDate.toISOString(),
      travelDurationMinutes: travelMinutes,
      feasible: true,
      reason: 'end_overruns_eod',
      reasonDetail: travelMinutes !== null
        ? `Travel from previous job: ~${travelMinutes} mins (+${travelBufferMinutes} min buffer). Suggested start: ${formatTime(suggestedStartDate)}. Note: the job (${proposedJobDurationMinutes} mins) would run until ${formatTime(suggestedEndDate)}, past the end of the working day (${workingDayEnd}).`
        : `Suggested start: ${formatTime(suggestedStartDate)}. Note: the job (${proposedJobDurationMinutes} mins) would run until ${formatTime(suggestedEndDate)}, past the end of the working day (${workingDayEnd}).`,
      overridable: true,
    }
  }

  return {
    engineerId,
    engineerName,
    suggestedStart: suggestedStartDate.toISOString(),
    suggestedEnd: suggestedEndDate.toISOString(),
    travelDurationMinutes: travelMinutes,
    feasible: true,
    reason: 'ok',
    reasonDetail: travelMinutes !== null
      ? `Travel from previous job: ~${travelMinutes} mins (+${travelBufferMinutes} min buffer). Suggested start: ${formatTime(suggestedStartDate)}. Job would complete by ${formatTime(suggestedEndDate)}.`
      : `Suggested start: ${formatTime(suggestedStartDate)}. Job would complete by ${formatTime(suggestedEndDate)}.`,
    overridable: true,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: appUser } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('auth_id', user.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body: RequestBody = await request.json()
    const {
      engineerId, conflictEnd, conflictAddress, proposedJobAddress,
      proposedJobDurationMinutes, targetDate, includeTeam,
      proposedStart, proposedEnd,
    } = body

    console.log('[smart-schedule] Body:', JSON.stringify({ engineerId, conflictEnd, conflictAddress, proposedJobAddress, proposedJobDurationMinutes, targetDate }))

    let workingDayStart: string
    let workingDayEnd: string
    let travelBufferMinutes: number
    try {
      const settings = await getSchedulingSettings(supabase, appUser.org_id)
      workingDayStart = settings.workingDayStart
      workingDayEnd = settings.workingDayEnd
      travelBufferMinutes = settings.travelBufferMinutes
      console.log('[smart-schedule] Settings:', JSON.stringify({ workingDayStart, workingDayEnd, travelBufferMinutes }))
    } catch (settingsErr) {
      console.error('[smart-schedule] Settings fetch failed:', settingsErr)
      workingDayStart = '08:00'
      workingDayEnd = '17:30'
      travelBufferMinutes = 15
    }

    clearGeocodeCache()

    // Get engineer name for primary suggestion
    const { data: engineer } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', engineerId)
      .single()

    const engineerName = engineer ? `${engineer.first_name} ${engineer.last_name}` : 'Engineer'

    // Get individual working hours for primary engineer
    const effectiveHours = await getEffectiveHoursForEngineer(
      supabase, appUser.org_id, engineerId, targetDate, workingDayStart, workingDayEnd
    )

    console.log('[smart-schedule] Engineer:', engineerName, 'Effective hours:', JSON.stringify(effectiveHours))

    // If this is a non-working day for the engineer, return hard block
    if (!effectiveHours.isWorkingDay) {
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const d = new Date(targetDate + 'T12:00:00')
      const jsDay = d.getDay()
      const isoDay = jsDay === 0 ? 7 : jsDay
      return NextResponse.json({
        primarySuggestion: {
          engineerId,
          engineerName,
          suggestedStart: null,
          suggestedEnd: null,
          travelDurationMinutes: null,
          feasible: false,
          reason: 'hard_block' as const,
          reasonDetail: `${engineerName} does not work on ${dayNames[isoDay]}s.`,
          overridable: false,
        },
      })
    }

    console.log('[smart-schedule] Input:', JSON.stringify({ conflictEnd, conflictAddress, proposedJobAddress, proposedJobDurationMinutes, targetDate }))

    // Validate conflictEnd is a parseable date
    const testDate = new Date(conflictEnd)
    if (isNaN(testDate.getTime())) {
      console.error('[smart-schedule] Invalid conflictEnd:', conflictEnd)
      return NextResponse.json({ error: 'Invalid conflictEnd date', primarySuggestion: null })
    }

    // Use engineer's individual end time for smart scheduling
    const engineerDayEnd = effectiveHours.endTime

    let primarySuggestion: SmartScheduleSuggestion
    try {
      primarySuggestion = await computeSuggestion(
        conflictEnd, conflictAddress, proposedJobAddress,
        proposedJobDurationMinutes, targetDate,
        engineerDayEnd, travelBufferMinutes,
        engineerId, engineerName,
      )
      console.log('[smart-schedule] Result reason:', primarySuggestion.reason)
    } catch (compErr) {
      console.error('[smart-schedule] computeSuggestion crashed:', compErr instanceof Error ? compErr.message : compErr)
      console.error('[smart-schedule] Stack:', compErr instanceof Error ? compErr.stack : '')
      return NextResponse.json({
        error: `Suggestion computation failed: ${compErr instanceof Error ? compErr.message : String(compErr)}`,
        primarySuggestion: null,
      })
    }

    let teamSuggestions: TeamMemberAvailability[] | undefined

    if (includeTeam && proposedStart && proposedEnd) {
      // Get all engineers
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('org_id', appUser.org_id)
        .eq('is_active', true)
        .in('slug', ['infrastructure', 'engineering'])

      const teamIds = teams?.map(t => t.id) || []
      let engineerUsers: { id: string; first_name: string; last_name: string }[] = []

      if (teamIds.length > 0) {
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id')
          .in('team_id', teamIds)
        const userIds = [...new Set(members?.map(m => m.user_id) || [])]
        if (userIds.length > 0) {
          const { data } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('org_id', appUser.org_id)
            .eq('is_active', true)
            .in('id', userIds)
            .neq('id', engineerId)
            .order('first_name')
          engineerUsers = data || []
        }
      } else {
        const { data } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('org_id', appUser.org_id)
          .eq('is_active', true)
          .neq('id', engineerId)
          .order('first_name')
        engineerUsers = data || []
      }

      teamSuggestions = []

      for (const eng of engineerUsers) {
        // Check individual working hours for this engineer
        const engEffective = await getEffectiveHoursForEngineer(
          supabase, appUser.org_id, eng.id, targetDate, workingDayStart, workingDayEnd
        )
        const engName = `${eng.first_name} ${eng.last_name}`

        // Skip engineers who don't work this day (treat as hard block)
        if (!engEffective.isWorkingDay) {
          // Don't include non-working engineers in team suggestions at all
          continue
        }

        // Check for conflicts for this engineer
        const { data: engJobs } = await supabase
          .from('jobs')
          .select(`
            id, job_number, scheduled_date, scheduled_time, estimated_duration_minutes, status,
            site_address_line1, site_address_line2, site_city, site_postcode,
            job_type:job_type_id(id, name, slug)
          `)
          .eq('org_id', appUser.org_id)
          .eq('assigned_to', eng.id)
          .eq('scheduled_date', targetDate)
          .not('status', 'in', '(cancelled,completed)')

        // Check activities for this engineer
        const { data: engActivities } = await supabase
          .from('activities')
          .select(`
            id, title, scheduled_date, scheduled_time, duration_minutes, all_day,
            activity_type:activity_type_id(id, name, slug)
          `)
          .eq('org_id', appUser.org_id)
          .eq('engineer_id', eng.id)
          .eq('scheduled_date', targetDate)

        let hasHardBlock = false
        let hasConflict = false
        let latestConflictEnd: Date | null = null
        let latestConflictAddress: string | null = null

        // Check activities first (annual leave)
        if (engActivities) {
          for (const act of engActivities) {
            const at = act.activity_type as unknown as { id: string; name: string; slug: string } | null
            const actConflictType = deriveActivityConflictType(at?.slug || null, at?.name || '')

            if (act.all_day) {
              if (actConflictType === 'annual_leave') {
                hasHardBlock = true
                break
              }
              hasConflict = true
            } else if (act.scheduled_time) {
              const actStart = new Date(`${act.scheduled_date}T${act.scheduled_time}`)
              const actEnd = new Date(actStart.getTime() + (act.duration_minutes || 60) * 60000)
              const pStart = new Date(proposedStart)
              const pEnd = new Date(proposedEnd)

              if (actStart < pEnd && actEnd > pStart) {
                if (actConflictType === 'annual_leave') {
                  hasHardBlock = true
                  break
                }
                hasConflict = true
                if (!latestConflictEnd || actEnd > latestConflictEnd) {
                  latestConflictEnd = actEnd
                }
              }
            }
          }
        }

        if (hasHardBlock) continue // Skip engineers on annual leave

        // Check jobs
        if (engJobs) {
          for (const job of engJobs) {
            if (!job.scheduled_time) continue
            const jobStart = new Date(`${job.scheduled_date}T${job.scheduled_time}`)
            const jobEnd = new Date(jobStart.getTime() + (job.estimated_duration_minutes || 60) * 60000)
            const pStart = new Date(proposedStart)
            const pEnd = new Date(proposedEnd)

            if (jobStart < pEnd && jobEnd > pStart) {
              hasConflict = true
              if (!latestConflictEnd || jobEnd > latestConflictEnd) {
                latestConflictEnd = jobEnd
                latestConflictAddress = formatAddress(
                  job.site_address_line1, job.site_address_line2,
                  job.site_city, job.site_postcode
                )
              }
            }
          }
        }

        if (!hasConflict) {
          // No conflict - suggest the originally proposed time
          teamSuggestions.push({
            engineerId: eng.id,
            engineerName: engName,
            hasConflict: false,
            conflictIsHardBlock: false,
            suggestion: {
              engineerId: eng.id,
              engineerName: engName,
              suggestedStart: proposedStart,
              suggestedEnd: proposedEnd,
              travelDurationMinutes: null,
              feasible: true,
              reason: 'ok',
              reasonDetail: 'No conflicts. Available at the originally proposed time.',
              overridable: true,
            },
          })
        } else if (latestConflictEnd) {
          // Has conflict - compute smart suggestion using this engineer's individual end time
          const suggestion = await computeSuggestion(
            latestConflictEnd.toISOString(),
            latestConflictAddress,
            proposedJobAddress,
            proposedJobDurationMinutes,
            targetDate,
            engEffective.endTime,
            travelBufferMinutes,
            eng.id,
            engName,
          )

          teamSuggestions.push({
            engineerId: eng.id,
            engineerName: engName,
            hasConflict: true,
            conflictIsHardBlock: false,
            suggestion,
          })
        }
      }

      // Sort: no-conflict first, then feasible, then infeasible
      teamSuggestions.sort((a, b) => {
        if (!a.hasConflict && b.hasConflict) return -1
        if (a.hasConflict && !b.hasConflict) return 1
        if (a.suggestion?.feasible && !b.suggestion?.feasible) return -1
        if (!a.suggestion?.feasible && b.suggestion?.feasible) return 1
        return 0
      })
    }

    return NextResponse.json({ primarySuggestion, teamSuggestions })
  } catch (err) {
    console.error('[smart-schedule] Error:', err instanceof Error ? err.message : err)
    console.error('[smart-schedule] Stack:', err instanceof Error ? err.stack : 'no stack')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
