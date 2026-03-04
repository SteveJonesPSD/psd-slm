'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillJobTasks(supabase: any, orgId: string): Promise<number> {
  // Find jobs whose job_type has a template but that have zero job_tasks
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_type_id')
    .eq('org_id', orgId)
    .not('job_type_id', 'is', null)

  if (!jobs || jobs.length === 0) return 0

  let backfilled = 0
  for (const job of jobs) {
    // Check if job already has tasks
    const { count } = await supabase
      .from('job_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id)

    if (count && count > 0) continue

    // Look up job type's template
    const { data: jt } = await supabase
      .from('job_types')
      .select('task_template_id')
      .eq('id', job.job_type_id)
      .single()

    if (!jt?.task_template_id) continue

    const { data: items } = await supabase
      .from('job_task_template_items')
      .select('*')
      .eq('template_id', jt.task_template_id)
      .order('sort_order')

    if (items && items.length > 0) {
      await supabase.from('job_tasks').insert(
        items.map((item: { id: string; description: string; is_required: boolean; response_type: string; sort_order: number }) => ({
          job_id: job.id,
          template_item_id: item.id,
          description: item.description,
          is_required: item.is_required,
          response_type: item.response_type || 'yes_no',
          sort_order: item.sort_order,
        }))
      )
      backfilled++
    }
  }
  return backfilled
}

export async function seedSchedulingData() {
  const user = await requirePermission('scheduling', 'admin')
  const supabase = await createClient()
  const orgId = user.orgId

  // Check if already seeded
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (count && count > 0) {
    // Already seeded — backfill job_tasks for any jobs missing them
    const backfilled = await backfillJobTasks(supabase, orgId)
    if (backfilled > 0) {
      revalidatePath('/scheduling')
      revalidatePath('/field')
      return { success: true, message: `Backfilled tasks for ${backfilled} job(s)` }
    }
    return { error: 'Scheduling data already seeded' }
  }

  // ======================================================================
  // 1. SEED JOB TYPES
  // ======================================================================
  const jobTypeData = [
    { name: 'Installation', slug: 'installation', color: '#059669', background: '#ecfdf5', default_duration_minutes: 120, sort_order: 0 },
    { name: 'Maintenance', slug: 'maintenance', color: '#2563eb', background: '#eff6ff', default_duration_minutes: 60, sort_order: 1 },
    { name: 'Reactive', slug: 'reactive', color: '#dc2626', background: '#fef2f2', default_duration_minutes: 60, sort_order: 2 },
    { name: 'Survey', slug: 'survey', color: '#d97706', background: '#fffbeb', default_duration_minutes: 90, sort_order: 3 },
    { name: 'Delivery', slug: 'delivery', color: '#7c3aed', background: '#f5f3ff', default_duration_minutes: 30, sort_order: 4 },
    { name: 'Other', slug: 'other', color: '#6b7280', background: '#f3f4f6', default_duration_minutes: 60, sort_order: 5 },
  ]

  const jobTypeIds: Record<string, string> = {}
  for (const jt of jobTypeData) {
    const { data: existing } = await supabase
      .from('job_types')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', jt.slug)
      .maybeSingle()

    if (existing) {
      jobTypeIds[jt.slug] = existing.id
    } else {
      const { data } = await supabase
        .from('job_types')
        .insert({ org_id: orgId, ...jt })
        .select('id')
        .single()
      if (data) jobTypeIds[jt.slug] = data.id
    }
  }

  // ======================================================================
  // 1b. SEED TASK TEMPLATES
  // ======================================================================
  const templateData = [
    {
      name: 'Server Maintenance Checklist',
      description: 'Standard checks for quarterly server maintenance visits',
      items: [
        { description: 'Check backup status and last successful backup date', is_required: true, response_type: 'yes_no', sort_order: 0 },
        { description: 'Verify disk space — flag if any volume >80% used', is_required: true, response_type: 'yes_no', sort_order: 1 },
        { description: 'Check event logs for critical errors (last 30 days)', is_required: true, response_type: 'yes_no', sort_order: 2 },
        { description: 'Verify all services are running (DNS, DHCP, AD, etc)', is_required: true, response_type: 'yes_no', sort_order: 3 },
        { description: 'UPS battery last test date', is_required: true, response_type: 'date', sort_order: 4 },
        { description: 'Firmware versions and pending updates', is_required: false, response_type: 'text', sort_order: 5 },
        { description: 'Clean dust filters and check airflow', is_required: false, response_type: 'yes_no', sort_order: 6 },
      ],
      linkTo: 'maintenance',
    },
    {
      name: 'Installation Checklist',
      description: 'Pre and post installation verification tasks',
      items: [
        { description: 'Confirm site access and key contact available', is_required: true, response_type: 'yes_no', sort_order: 0 },
        { description: 'Verify power supply at installation point', is_required: true, response_type: 'yes_no', sort_order: 1 },
        { description: 'Check cable route and confirm with site manager', is_required: true, response_type: 'yes_no', sort_order: 2 },
        { description: 'Mount and connect equipment', is_required: true, response_type: 'yes_no', sort_order: 3 },
        { description: 'Device IP / hostname on network', is_required: true, response_type: 'text', sort_order: 4 },
        { description: 'Run post-install diagnostics / test readings', is_required: true, response_type: 'yes_no', sort_order: 5 },
        { description: 'Label all cables and ports', is_required: true, response_type: 'yes_no', sort_order: 6 },
        { description: 'Date of handover to site contact', is_required: false, response_type: 'date', sort_order: 7 },
      ],
      linkTo: 'installation',
    },
    {
      name: 'Network Survey Checklist',
      description: 'Tasks for network infrastructure surveys',
      items: [
        { description: 'Document rack layout and available RU space', is_required: true, response_type: 'yes_no', sort_order: 0 },
        { description: 'Photograph all racks and patch panels', is_required: true, response_type: 'yes_no', sort_order: 1 },
        { description: 'Number of live cable runs documented', is_required: true, response_type: 'text', sort_order: 2 },
        { description: 'Test network ports and document live connections', is_required: true, response_type: 'yes_no', sort_order: 3 },
        { description: 'Environmental conditions notes (temp, humidity, ventilation)', is_required: false, response_type: 'text', sort_order: 4 },
      ],
      linkTo: 'survey',
    },
  ]

  const templateIds: Record<string, string> = {}
  for (const tpl of templateData) {
    const { data: existing } = await supabase
      .from('job_task_templates')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', tpl.name)
      .maybeSingle()

    let templateId: string
    if (existing) {
      templateId = existing.id
    } else {
      const { data } = await supabase
        .from('job_task_templates')
        .insert({ org_id: orgId, name: tpl.name, description: tpl.description })
        .select('id')
        .single()
      if (!data) continue
      templateId = data.id

      // Insert items
      await supabase.from('job_task_template_items').insert(
        tpl.items.map(item => ({ template_id: templateId, ...item }))
      )
    }
    templateIds[tpl.linkTo] = templateId

    // Link template to job type
    if (jobTypeIds[tpl.linkTo]) {
      await supabase
        .from('job_types')
        .update({ task_template_id: templateId })
        .eq('id', jobTypeIds[tpl.linkTo])
    }
  }

  // ======================================================================
  // 2. FIND CUSTOMERS & CONTACTS
  // ======================================================================
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, address_line1, address_line2, city, county, postcode')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const findCustomer = (partial: string) => customers?.find(c => c.name.includes(partial))

  const meridian = findCustomer('Meridian')
  const northernHealth = findCustomer('Northern Health')
  const hartwell = findCustomer('Hartwell')
  const pennine = findCustomer('Pennine')

  if (!meridian || !northernHealth || !hartwell || !pennine) {
    return { error: 'Required customers not found. Please seed company data first.' }
  }

  // Find contacts — try by name, fall back to first contact for that company
  const findContact = async (customerId: string, partial: string) => {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('first_name')

    return data?.find(c => `${c.first_name} ${c.last_name}`.includes(partial)) || data?.[0] || null
  }

  const sarahMitchell = await findContact(meridian.id, 'Sarah')
  const davidChen = await findContact(meridian.id, 'David')
  const jamesWhitworth = await findContact(northernHealth.id, 'James')
  const emmaRichardson = await findContact(hartwell.id, 'Emma')
  const tomBradley = await findContact(pennine.id, 'Tom')

  // ======================================================================
  // 3. SEED TEAMS & FIND ENGINEERS
  // ======================================================================

  // Create default scheduling teams if they don't exist
  const teamData = [
    { name: 'Infrastructure', slug: 'infrastructure', description: 'Infrastructure engineers — cabling, networking, access control', color: '#2563eb' },
    { name: 'Engineering', slug: 'engineering', description: 'Field engineers — installations, maintenance, reactive', color: '#059669' },
  ]

  const teamIds: Record<string, string> = {}
  for (const t of teamData) {
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', t.slug)
      .maybeSingle()

    if (existing) {
      teamIds[t.slug] = existing.id
    } else {
      const { data } = await supabase
        .from('teams')
        .insert({ org_id: orgId, ...t })
        .select('id')
        .single()
      if (data) teamIds[t.slug] = data.id
    }
  }

  // Find all active users
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('first_name')
    .limit(10)

  // Use the first two available users as engineers, or fall back to the current user
  const engineer1 = allUsers?.[0] || { id: user.id, first_name: user.firstName, last_name: user.lastName }
  const engineer2 = allUsers?.[1] || engineer1

  // Add engineers to teams (both go into Engineering, first also into Infrastructure)
  const engineeringTeamId = teamIds['engineering']
  const infraTeamId = teamIds['infrastructure']

  if (engineeringTeamId) {
    for (const eng of [engineer1, engineer2]) {
      await supabase
        .from('team_members')
        .upsert({ team_id: engineeringTeamId, user_id: eng.id }, { onConflict: 'team_id,user_id' })
    }
  }
  if (infraTeamId) {
    await supabase
      .from('team_members')
      .upsert({ team_id: infraTeamId, user_id: engineer1.id }, { onConflict: 'team_id,user_id' })
  }

  // ======================================================================
  // 4. SEED JOBS
  // ======================================================================
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString()

  const jobsData = [
    // Job 1: Completed installation
    {
      job_number: 'JOB-2026-0001',
      title: 'EnviroSentry sensor installation — Phase 1',
      description: 'Install 12 EnviroSentry environmental monitoring sensors across 4 classrooms in the main building. Cable routes need to go through ceiling void.',
      company_id: meridian.id,
      contact_id: sarahMitchell?.id || null,
      job_type_id: jobTypeIds.installation,
      priority: 'normal' as const,
      status: 'completed' as const,
      assigned_to: engineer1.id,
      scheduled_date: today,
      scheduled_time: '09:00',
      estimated_duration_minutes: 180,
      site_address_line1: meridian.address_line1,
      site_address_line2: meridian.address_line2,
      site_city: meridian.city,
      site_county: meridian.county,
      site_postcode: meridian.postcode,
      completed_at: new Date(new Date().setHours(12, 30)).toISOString(),
      completion_notes: '12 units installed across 4 classrooms. All reading correctly on dashboard. Cable runs completed in ceiling void.',
      travel_started_at: new Date(new Date().setHours(8, 30)).toISOString(),
      arrived_at: new Date(new Date().setHours(8, 55)).toISOString(),
    },
    // Job 2: Scheduled survey
    {
      job_number: 'JOB-2026-0002',
      title: 'Ward environmental monitoring — site survey',
      description: 'Survey Ward 3 and Ward 7 for EnviroSentry sensor placement. Check existing cable runs and power availability.',
      company_id: northernHealth.id,
      contact_id: jamesWhitworth?.id || null,
      job_type_id: jobTypeIds.survey,
      priority: 'high' as const,
      status: 'scheduled' as const,
      assigned_to: engineer2.id,
      scheduled_date: today,
      scheduled_time: '14:00',
      estimated_duration_minutes: 120,
      site_address_line1: northernHealth.address_line1,
      site_address_line2: northernHealth.address_line2,
      site_city: northernHealth.city,
      site_county: northernHealth.county,
      site_postcode: northernHealth.postcode,
    },
    // Job 3: Travelling reactive
    {
      job_number: 'JOB-2026-0003',
      title: 'Exchange Tower — AP offline on floor 3',
      description: 'Access point in the 3rd floor open plan area has gone offline. Not responding to pings. May need replacing.',
      company_id: hartwell.id,
      contact_id: emmaRichardson?.id || null,
      job_type_id: jobTypeIds.reactive,
      priority: 'urgent' as const,
      status: 'travelling' as const,
      assigned_to: engineer1.id,
      scheduled_date: today,
      scheduled_time: '14:00',
      estimated_duration_minutes: 60,
      site_address_line1: hartwell.address_line1,
      site_address_line2: hartwell.address_line2,
      site_city: hartwell.city,
      site_county: hartwell.county,
      site_postcode: hartwell.postcode,
      travel_started_at: thirtyMinAgo,
    },
    // Job 4: Scheduled installation for tomorrow
    {
      job_number: 'JOB-2026-0004',
      title: 'IngressaEdge reader install — reception',
      description: 'Install BLE access reader at main reception. Coordinate with building manager for access to comms room.',
      company_id: pennine.id,
      contact_id: tomBradley?.id || null,
      job_type_id: jobTypeIds.installation,
      priority: 'normal' as const,
      status: 'scheduled' as const,
      assigned_to: engineer2.id,
      scheduled_date: tomorrow,
      scheduled_time: '09:00',
      estimated_duration_minutes: 240,
      site_address_line1: pennine.address_line1,
      site_address_line2: pennine.address_line2,
      site_city: pennine.city,
      site_county: pennine.county,
      site_postcode: pennine.postcode,
    },
    // Job 5: Unscheduled (job pool)
    {
      job_number: 'JOB-2026-0005',
      title: 'Quarterly sensor calibration check',
      description: 'Quarterly calibration verification for all EnviroSentry sensors. Check readings against reference meters.',
      company_id: meridian.id,
      contact_id: davidChen?.id || null,
      job_type_id: jobTypeIds.maintenance,
      priority: 'low' as const,
      status: 'unscheduled' as const,
      estimated_duration_minutes: 120,
      site_address_line1: meridian.address_line1,
      site_address_line2: meridian.address_line2,
      site_city: meridian.city,
      site_county: meridian.county,
      site_postcode: meridian.postcode,
    },
    // Job 6: Scheduled delivery for tomorrow
    {
      job_number: 'JOB-2026-0006',
      title: 'Switch delivery — Ward 7 comms room',
      description: 'Deliver Cisco Catalyst switch for Ward 7 network upgrade. Leave with IT on Ward 7.',
      company_id: northernHealth.id,
      contact_id: jamesWhitworth?.id || null,
      job_type_id: jobTypeIds.delivery,
      priority: 'normal' as const,
      status: 'scheduled' as const,
      assigned_to: engineer1.id,
      scheduled_date: tomorrow,
      scheduled_time: '11:00',
      estimated_duration_minutes: 30,
      site_address_line1: northernHealth.address_line1,
      site_address_line2: northernHealth.address_line2,
      site_city: northernHealth.city,
      site_county: northernHealth.county,
      site_postcode: northernHealth.postcode,
    },
    // Job 7: Unscheduled survey (job pool)
    {
      job_number: 'JOB-2026-0007',
      title: 'Basement comms room audit',
      description: 'Full audit of basement comms room. Document rack layout, cabling, and available capacity.',
      company_id: hartwell.id,
      contact_id: emmaRichardson?.id || null,
      job_type_id: jobTypeIds.survey,
      priority: 'normal' as const,
      status: 'unscheduled' as const,
      estimated_duration_minutes: 90,
      site_address_line1: hartwell.address_line1,
      site_address_line2: hartwell.address_line2,
      site_city: hartwell.city,
      site_county: hartwell.county,
      site_postcode: hartwell.postcode,
    },
    // Job 8: Scheduled reactive for day after tomorrow
    {
      job_number: 'JOB-2026-0008',
      title: 'Vape sensor false alarms — pool area',
      description: 'Multiple false positives from the vape detection sensor near the pool area. High humidity may be triggering.',
      company_id: pennine.id,
      contact_id: tomBradley?.id || null,
      job_type_id: jobTypeIds.reactive,
      priority: 'high' as const,
      status: 'scheduled' as const,
      assigned_to: engineer2.id,
      scheduled_date: dayAfterTomorrow,
      scheduled_time: '10:00',
      estimated_duration_minutes: 120,
      site_address_line1: pennine.address_line1,
      site_address_line2: pennine.address_line2,
      site_city: pennine.city,
      site_county: pennine.county,
      site_postcode: pennine.postcode,
    },
  ]

  const jobIds: Record<string, string> = {}
  for (const job of jobsData) {
    const { data } = await supabase
      .from('jobs')
      .insert({
        org_id: orgId,
        created_by: user.id,
        ...job,
      })
      .select('id, job_number')
      .single()

    if (data) {
      jobIds[data.job_number] = data.id

      // Materialise task template items as job_tasks
      if (job.job_type_id) {
        const { data: jt } = await supabase
          .from('job_types')
          .select('task_template_id')
          .eq('id', job.job_type_id)
          .single()

        if (jt?.task_template_id) {
          const { data: templateItems } = await supabase
            .from('job_task_template_items')
            .select('*')
            .eq('template_id', jt.task_template_id)
            .order('sort_order')

          if (templateItems && templateItems.length > 0) {
            await supabase.from('job_tasks').insert(
              templateItems.map(item => ({
                job_id: data.id,
                template_item_id: item.id,
                description: item.description,
                is_required: item.is_required,
                response_type: item.response_type || 'yes_no',
                sort_order: item.sort_order,
              }))
            )
          }
        }
      }
    }
  }

  // ======================================================================
  // 5. SEED JOB NOTES (on Job 1)
  // ======================================================================
  const job1Id = jobIds['JOB-2026-0001']
  if (job1Id) {
    const noteData = [
      {
        job_id: job1Id,
        user_id: engineer1.id,
        note: 'Arrived on site. Sarah showed me to the first classroom. Existing cable routes look good.',
        created_at: new Date(new Date().setHours(9, 5)).toISOString(),
      },
      {
        job_id: job1Id,
        user_id: engineer1.id,
        note: 'All 12 sensors mounted and connected. Running post-install diagnostics now.',
        created_at: new Date(new Date().setHours(11, 30)).toISOString(),
      },
      {
        job_id: job1Id,
        user_id: engineer1.id,
        note: 'Everything reading correctly. Left 2 spare sensor heads with Sarah for the IT cupboard.',
        created_at: new Date(new Date().setHours(12, 15)).toISOString(),
      },
    ]

    for (const n of noteData) {
      await supabase.from('job_notes').insert(n)
    }
  }

  revalidatePath('/scheduling')
  revalidatePath('/settings/data')

  return {
    success: true,
    created: {
      teams: Object.keys(teamIds).length,
      job_types: Object.keys(jobTypeIds).length,
      task_templates: Object.keys(templateIds).length,
      jobs: Object.keys(jobIds).length,
      notes: 3,
    },
  }
}
