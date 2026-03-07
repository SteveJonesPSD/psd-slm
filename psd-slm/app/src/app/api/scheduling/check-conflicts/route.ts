import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ConflictCheckInput, ScheduleConflict } from '@/lib/scheduling/conflict'
import { deriveConflictType, deriveActivityConflictType, formatAddress } from '@/lib/scheduling/conflict'

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

    const body: ConflictCheckInput = await request.json()
    const { engineerId, proposedStart, proposedEnd, excludeJobId } = body

    if (!engineerId || !proposedStart || !proposedEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch travel buffer from org_settings
    const { data: bufferSetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', appUser.org_id)
      .eq('setting_key', 'travel_buffer_minutes')
      .single()

    let travelBufferMs = 15 * 60000 // default 15 mins
    if (bufferSetting?.setting_value) {
      try {
        travelBufferMs = (parseInt(JSON.parse(bufferSetting.setting_value)) || 15) * 60000
      } catch { /* use default */ }
    }

    const pStart = new Date(proposedStart)
    const pEnd = new Date(proposedEnd)
    const conflicts: ScheduleConflict[] = []

    // Check individual working hours for this engineer
    const proposedDate = proposedStart.split('T')[0]
    const d = new Date(proposedDate + 'T12:00:00')
    const jsDay = d.getDay()
    const isoDay = jsDay === 0 ? 7 : jsDay

    const { data: userHoursRow } = await supabase
      .from('user_working_hours')
      .select('is_working_day, start_time, end_time')
      .eq('user_id', engineerId)
      .eq('day_of_week', isoDay)
      .maybeSingle()

    if (userHoursRow && !userHoursRow.is_working_day) {
      // Non-working day — hard block
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      conflicts.push({
        source: 'activity',
        conflictingActivityId: `non-working-day-${isoDay}`,
        conflictingTitle: `Not working (${dayNames[isoDay]})`,
        conflictType: 'annual_leave', // treated as hard block
        conflictingStart: `${proposedDate}T00:00:00`,
        conflictingEnd: `${proposedDate}T23:59:59`,
        activityTypeName: 'Non-working day',
        isAllDay: true,
        isHardBlock: true,
      })
      return NextResponse.json({ conflicts })
    }

    // Check if proposed times fall outside individual working hours (overridable)
    if (userHoursRow && userHoursRow.is_working_day) {
      // Fetch org defaults to fill in any nulls
      const { data: orgSettings } = await supabase
        .from('org_settings')
        .select('setting_key, setting_value')
        .eq('org_id', appUser.org_id)
        .eq('category', 'scheduling')
        .in('setting_key', ['working_day_start', 'working_day_end'])

      let orgStart = '08:00'
      let orgEnd = '17:30'
      if (orgSettings) {
        for (const s of orgSettings) {
          try {
            if (s.setting_key === 'working_day_start') orgStart = JSON.parse(s.setting_value)
            else if (s.setting_key === 'working_day_end') orgEnd = JSON.parse(s.setting_value)
          } catch { /* skip */ }
        }
      }

      const effectiveStart = userHoursRow.start_time || orgStart
      const effectiveEnd = userHoursRow.end_time || orgEnd

      const [esH, esM] = effectiveStart.split(':').map(Number)
      const [eeH, eeM] = effectiveEnd.split(':').map(Number)
      const workStart = new Date(`${proposedDate}T${String(esH).padStart(2, '0')}:${String(esM).padStart(2, '0')}:00`)
      const workEnd = new Date(`${proposedDate}T${String(eeH).padStart(2, '0')}:${String(eeM).padStart(2, '0')}:00`)

      if (pStart < workStart || pEnd > workEnd) {
        conflicts.push({
          source: 'activity',
          conflictingActivityId: `outside-hours-${isoDay}`,
          conflictingTitle: `Outside working hours (${effectiveStart}–${effectiveEnd})`,
          conflictType: 'other_non_job',
          conflictingStart: pStart < workStart ? workStart.toISOString() : workEnd.toISOString(),
          conflictingEnd: pStart < workStart ? workStart.toISOString() : workEnd.toISOString(),
          activityTypeName: 'Reduced hours',
          isAllDay: false,
          isHardBlock: false,
        })
      }
    }

    // Check jobs for conflicts (overlaps + insufficient travel gaps)
    let jobQuery = supabase
      .from('jobs')
      .select(`
        id, job_number, scheduled_date, scheduled_time, estimated_duration_minutes, status,
        site_address_line1, site_address_line2, site_city, site_postcode,
        job_type:job_type_id(id, name, slug),
        company:company_id(id, name)
      `)
      .eq('org_id', appUser.org_id)
      .eq('assigned_to', engineerId)
      .eq('scheduled_date', proposedDate)
      .not('status', 'in', '(cancelled,completed)')

    if (excludeJobId) {
      jobQuery = jobQuery.neq('id', excludeJobId)
    }

    const { data: jobs } = await jobQuery

    if (jobs) {
      for (const job of jobs) {
        if (!job.scheduled_date || !job.scheduled_time) continue

        const jobStart = new Date(`${job.scheduled_date}T${job.scheduled_time}`)
        const jobEnd = new Date(jobStart.getTime() + (job.estimated_duration_minutes || 60) * 60000)

        const jt = job.job_type as unknown as { id: string; name: string; slug: string } | null
        const company = job.company as unknown as { id: string; name: string } | null
        const address = formatAddress(job.site_address_line1, job.site_address_line2, job.site_city, job.site_postcode)

        // Check direct time overlap: jobStart < proposedEnd AND jobEnd > proposedStart
        if (jobStart < pEnd && jobEnd > pStart) {
          const conflictType = deriveConflictType(jt?.slug || null, jt?.name || '')
          conflicts.push({
            source: 'job',
            conflictingJobId: job.id,
            conflictingJobNumber: job.job_number,
            conflictType,
            conflictingStart: jobStart.toISOString(),
            conflictingEnd: jobEnd.toISOString(),
            jobTypeName: jt?.name || 'Unknown',
            customerName: company?.name || null,
            address,
            isHardBlock: conflictType === 'annual_leave',
          })
          continue
        }

        // Check insufficient travel gap:
        // Previous job ends BEFORE proposed start, but gap is less than travel buffer
        const gapAfterPrevious = pStart.getTime() - jobEnd.getTime()
        if (gapAfterPrevious >= 0 && gapAfterPrevious < travelBufferMs) {
          conflicts.push({
            source: 'job',
            conflictingJobId: job.id,
            conflictingJobNumber: job.job_number,
            conflictType: 'no_travel_gap',
            conflictingStart: jobStart.toISOString(),
            conflictingEnd: jobEnd.toISOString(),
            jobTypeName: jt?.name || 'Unknown',
            customerName: company?.name || null,
            address,
            isHardBlock: false,
          })
          continue
        }

        // Proposed job ends BEFORE existing job starts, but gap is less than travel buffer
        const gapBeforeNext = jobStart.getTime() - pEnd.getTime()
        if (gapBeforeNext >= 0 && gapBeforeNext < travelBufferMs) {
          conflicts.push({
            source: 'job',
            conflictingJobId: job.id,
            conflictingJobNumber: job.job_number,
            conflictType: 'no_travel_gap',
            conflictingStart: jobStart.toISOString(),
            conflictingEnd: jobEnd.toISOString(),
            jobTypeName: jt?.name || 'Unknown',
            customerName: company?.name || null,
            address,
            isHardBlock: false,
          })
        }
      }
    }

    // Check activities for conflicts (annual leave, training, etc.)
    const { data: activities } = await supabase
      .from('activities')
      .select(`
        id, title, scheduled_date, scheduled_time, duration_minutes, all_day,
        activity_type:activity_type_id(id, name, slug)
      `)
      .eq('org_id', appUser.org_id)
      .eq('engineer_id', engineerId)
      .eq('scheduled_date', proposedDate)

    if (activities) {
      for (const act of activities) {
        const at = act.activity_type as unknown as { id: string; name: string; slug: string } | null
        const conflictType = deriveActivityConflictType(at?.slug || null, at?.name || '')

        if (act.all_day) {
          conflicts.push({
            source: 'activity',
            conflictingActivityId: act.id,
            conflictingTitle: act.title,
            conflictType,
            conflictingStart: `${act.scheduled_date}T00:00:00`,
            conflictingEnd: `${act.scheduled_date}T23:59:59`,
            activityTypeName: at?.name || 'Activity',
            isAllDay: true,
            isHardBlock: conflictType === 'annual_leave',
          })
        } else if (act.scheduled_time) {
          const actStart = new Date(`${act.scheduled_date}T${act.scheduled_time}`)
          const actEnd = new Date(actStart.getTime() + (act.duration_minutes || 60) * 60000)

          // Direct overlap
          if (actStart < pEnd && actEnd > pStart) {
            conflicts.push({
              source: 'activity',
              conflictingActivityId: act.id,
              conflictingTitle: act.title,
              conflictType,
              conflictingStart: actStart.toISOString(),
              conflictingEnd: actEnd.toISOString(),
              activityTypeName: at?.name || 'Activity',
              isAllDay: false,
              isHardBlock: conflictType === 'annual_leave',
            })
            continue
          }

          // Insufficient gap (activity before proposed)
          const gapAfter = pStart.getTime() - actEnd.getTime()
          if (gapAfter >= 0 && gapAfter < travelBufferMs) {
            conflicts.push({
              source: 'activity',
              conflictingActivityId: act.id,
              conflictingTitle: act.title,
              conflictType: 'no_travel_gap',
              conflictingStart: actStart.toISOString(),
              conflictingEnd: actEnd.toISOString(),
              activityTypeName: at?.name || 'Activity',
              isAllDay: false,
              isHardBlock: false,
            })
            continue
          }

          // Insufficient gap (proposed before activity)
          const gapBefore = actStart.getTime() - pEnd.getTime()
          if (gapBefore >= 0 && gapBefore < travelBufferMs) {
            conflicts.push({
              source: 'activity',
              conflictingActivityId: act.id,
              conflictingTitle: act.title,
              conflictType: 'no_travel_gap',
              conflictingStart: actStart.toISOString(),
              conflictingEnd: actEnd.toISOString(),
              activityTypeName: at?.name || 'Activity',
              isAllDay: false,
              isHardBlock: false,
            })
          }
        }
      }
    }

    return NextResponse.json({ conflicts })
  } catch (err) {
    console.error('[check-conflicts]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
