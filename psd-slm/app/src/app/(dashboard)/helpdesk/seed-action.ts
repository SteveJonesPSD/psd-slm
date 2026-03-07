'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { calculateSlaDeadline } from '@/lib/sla'
import { formatTicketNumber } from '@/lib/helpdesk'
import type { SlaPlan, SlaPlanTarget } from '@/types/database'

export async function seedHelpdeskData() {
  const user = await requirePermission('helpdesk', 'admin')
  const supabase = await createClient()
  const orgId = user.orgId

  // ======================================================================
  // 1. CATEGORIES
  // ======================================================================
  const categoryData = [
    { name: 'Hardware', description: 'Physical device issues' },
    { name: 'Software', description: 'Application and OS issues' },
    { name: 'Network', description: 'Connectivity and infrastructure' },
    { name: 'Email', description: 'Email and Exchange issues' },
    { name: 'Printing', description: 'Printers and print queues' },
    { name: 'Account Access', description: 'Password resets and permissions' },
    { name: 'General', description: 'General enquiries' },
  ]

  const categoryIds: Record<string, string> = {}
  for (const cat of categoryData) {
    const { data: existing } = await supabase
      .from('ticket_categories')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', cat.name)
      .maybeSingle()

    if (existing) {
      categoryIds[cat.name] = existing.id
    } else {
      const { data } = await supabase
        .from('ticket_categories')
        .insert({ org_id: orgId, ...cat })
        .select('id')
        .single()
      if (data) categoryIds[cat.name] = data.id
    }
  }

  // ======================================================================
  // 2. TAGS
  // ======================================================================
  const tagData = [
    { name: 'VIP', color: '#dc2626' },
    { name: 'Recurring', color: '#d97706' },
    { name: 'Training', color: '#2563eb' },
    { name: 'Warranty', color: '#059669' },
    { name: 'Safeguarding', color: '#7c3aed' },
    { name: 'COVID', color: '#6b7280' },
  ]

  const tagIds: Record<string, string> = {}
  for (const tag of tagData) {
    const { data: existing } = await supabase
      .from('ticket_tags')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', tag.name)
      .maybeSingle()

    if (existing) {
      tagIds[tag.name] = existing.id
    } else {
      const { data } = await supabase
        .from('ticket_tags')
        .insert({ org_id: orgId, ...tag })
        .select('id')
        .single()
      if (data) tagIds[tag.name] = data.id
    }
  }

  // ======================================================================
  // 3. SLA PLANS
  // ======================================================================
  const slaPlans = [
    {
      name: 'Standard',
      description: 'Standard business hours support',
      business_hours_start: '08:00',
      business_hours_end: '17:30',
      business_days: [1, 2, 3, 4, 5],
      is_24x7: false,
      is_default: true,
      targets: [
        { priority: 'urgent', response_time_minutes: 60, resolution_time_minutes: 480 },
        { priority: 'high', response_time_minutes: 120, resolution_time_minutes: 960 },
        { priority: 'medium', response_time_minutes: 240, resolution_time_minutes: 2400 },
        { priority: 'low', response_time_minutes: 480, resolution_time_minutes: 4800 },
      ],
    },
    {
      name: 'Premium',
      description: 'Premium support with faster response times',
      business_hours_start: '07:00',
      business_hours_end: '19:00',
      business_days: [1, 2, 3, 4, 5],
      is_24x7: false,
      is_default: false,
      targets: [
        { priority: 'urgent', response_time_minutes: 30, resolution_time_minutes: 240 },
        { priority: 'high', response_time_minutes: 60, resolution_time_minutes: 480 },
        { priority: 'medium', response_time_minutes: 120, resolution_time_minutes: 1440 },
        { priority: 'low', response_time_minutes: 240, resolution_time_minutes: 2880 },
      ],
    },
    {
      name: '24x7 Critical',
      description: 'Round-the-clock support for critical infrastructure',
      business_hours_start: '00:00',
      business_hours_end: '23:59',
      business_days: [0, 1, 2, 3, 4, 5, 6],
      is_24x7: true,
      is_default: false,
      targets: [
        { priority: 'urgent', response_time_minutes: 15, resolution_time_minutes: 120 },
        { priority: 'high', response_time_minutes: 30, resolution_time_minutes: 240 },
        { priority: 'medium', response_time_minutes: 60, resolution_time_minutes: 480 },
        { priority: 'low', response_time_minutes: 120, resolution_time_minutes: 960 },
      ],
    },
  ]

  const slaPlanIds: Record<string, string> = {}
  for (const plan of slaPlans) {
    const { targets, ...planData } = plan
    const { data: existing } = await supabase
      .from('sla_plans')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', plan.name)
      .maybeSingle()

    if (existing) {
      slaPlanIds[plan.name] = existing.id
    } else {
      const { data } = await supabase
        .from('sla_plans')
        .insert({ org_id: orgId, ...planData })
        .select('id')
        .single()

      if (data) {
        slaPlanIds[plan.name] = data.id
        await supabase.from('sla_plan_targets').insert(
          targets.map(t => ({ sla_plan_id: data.id, ...t }))
        )
      }
    }
  }

  // ======================================================================
  // 4. SUPPORT CONTRACTS (need customers + contract_types)
  // ======================================================================
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name')

  const customerMap: Record<string, string> = {}
  for (const c of customers || []) {
    customerMap[c.name] = c.id
  }

  // Fetch contract types to resolve IDs
  const { data: contractTypes } = await supabase
    .from('contract_types')
    .select('id, name')
    .eq('org_id', orgId)

  const contractTypeMap: Record<string, string> = {}
  for (const ct of contractTypes || []) {
    contractTypeMap[ct.name] = ct.id
  }

  const contractData = [
    { customerName: 'Meridian Academy', contractNumber: 'SC-MERIDIAN-001', contractTypeName: 'ProFlex 4', sla: 'Premium', monthly_hours: 20 },
    { customerName: 'NHS Bradford', contractNumber: 'SC-NHS-001', contractTypeName: 'ProFlex 2', sla: '24x7 Critical', monthly_hours: 40 },
    { customerName: 'Hartwell Engineering', contractNumber: 'SC-HARTWELL-001', contractTypeName: 'ProFlex 1', sla: 'Standard', monthly_hours: 10 },
    { customerName: 'Pennine Care Trust', contractNumber: 'SC-PENNINE-001', contractTypeName: 'ProFlex 3', sla: 'Standard', monthly_hours: 8 },
  ]

  const contractIds: Record<string, string> = {}
  for (const cd of contractData) {
    const customerId = customerMap[cd.customerName]
    if (!customerId) continue

    const { data: existing } = await supabase
      .from('customer_contracts')
      .select('id')
      .eq('org_id', orgId)
      .eq('contract_number', cd.contractNumber)
      .maybeSingle()

    if (existing) {
      contractIds[cd.contractNumber] = existing.id
    } else {
      const contractTypeId = contractTypeMap[cd.contractTypeName] || Object.values(contractTypeMap)[0]
      const { data } = await supabase
        .from('customer_contracts')
        .insert({
          org_id: orgId,
          customer_id: customerId,
          contract_type_id: contractTypeId,
          sla_plan_id: slaPlanIds[cd.sla] || null,
          contract_number: cd.contractNumber,
          monthly_hours: cd.monthly_hours,
          start_date: '2026-01-01',
          status: 'active',
        })
        .select('id')
        .single()
      if (data) contractIds[cd.contractNumber] = data.id
    }
  }

  // ======================================================================
  // 5. SEED TICKETS (if none exist)
  // ======================================================================
  const { count: ticketCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (!ticketCount || ticketCount === 0) {
    // Fetch team members for assignment
    const { data: teamMembers } = await supabase
      .from('users')
      .select('id, first_name, last_name, roles(name)')
      .eq('org_id', orgId)
      .eq('is_active', true)

    const memberByName: Record<string, string> = {}
    for (const m of teamMembers || []) {
      memberByName[`${m.first_name} ${m.last_name}`] = m.id
    }

    // Get SLA plan details for deadline calculation
    const { data: standardPlan } = await supabase
      .from('sla_plans')
      .select('*, sla_plan_targets(*)')
      .eq('id', slaPlanIds['Standard'] || '')
      .maybeSingle()

    const { data: premiumPlan } = await supabase
      .from('sla_plans')
      .select('*, sla_plan_targets(*)')
      .eq('id', slaPlanIds['Premium'] || '')
      .maybeSingle()

    const ticketsToCreate = [
      {
        customer: 'Meridian Academy',
        subject: 'Projector not displaying in Room 12',
        description: 'The ceiling-mounted projector in Room 12 is not showing any image when connected to the classroom PC. The power light is on but no signal is being detected.',
        priority: 'high',
        ticket_type: 'helpdesk',
        category: 'Hardware',
        assigned_to: 'Dan Whittle',
        contract: 'SC-MERIDIAN-001',
        tags: ['VIP'],
      },
      {
        customer: 'Hartwell Engineering',
        subject: 'Cannot access shared drive after password change',
        description: 'Since changing my Windows password yesterday, I can no longer map the \\\\server\\shared drive. Getting an access denied error.',
        priority: 'medium',
        ticket_type: 'helpdesk',
        category: 'Account Access',
        assigned_to: 'Sam Hartley',
        contract: 'SC-HARTWELL-001',
        tags: [],
      },
      {
        customer: 'Pennine Care Trust',
        subject: 'Replace failed switch in server room',
        description: 'The HP 2530-24G switch in Rack 3 has failed — no power lights. Needs physical replacement on next onsite visit.',
        priority: 'urgent',
        ticket_type: 'onsite_job',
        category: 'Network',
        assigned_to: 'Dan Whittle',
        contract: 'SC-PENNINE-001',
        tags: [],
        site_location: 'Main Server Room',
        room_number: 'SR-1',
        device_details: 'HP 2530-24G, Serial: CN12345678',
      },
      {
        customer: 'Meridian Academy',
        subject: 'Outlook keeps freezing on reception PC',
        description: 'The reception PC running Outlook 365 freezes every 10-15 minutes. Requires force close. Started after the latest Windows update.',
        priority: 'medium',
        ticket_type: 'helpdesk',
        category: 'Email',
        assigned_to: null,
        contract: 'SC-MERIDIAN-001',
        tags: ['Recurring'],
      },
      {
        customer: 'NHS Bradford',
        subject: 'New starter accounts needed — 3 nurses',
        description: 'Please create Active Directory accounts, email, and clinical system access for 3 new nursing staff starting 10th March.',
        priority: 'low',
        ticket_type: 'helpdesk',
        category: 'Account Access',
        assigned_to: 'Sam Hartley',
        contract: 'SC-NHS-001',
        tags: [],
      },
    ]

    let seq = 1
    for (const td of ticketsToCreate) {
      const customerId = customerMap[td.customer]
      if (!customerId) continue

      const ticketNumber = formatTicketNumber(2026, seq++)
      const contractId = td.contract ? contractIds[td.contract] : null
      const planToUse = td.contract?.includes('MERIDIAN')
        ? premiumPlan
        : standardPlan

      let slaResponseDue: string | null = null
      let slaResolutionDue: string | null = null
      const createdAt = new Date(Date.now() - Math.random() * 86400000 * 3) // random within last 3 days

      if (planToUse) {
        const target = (planToUse.sla_plan_targets as SlaPlanTarget[])?.find(
          (t: SlaPlanTarget) => t.priority === td.priority
        )
        if (target) {
          const plan = planToUse as unknown as SlaPlan
          slaResponseDue = calculateSlaDeadline(createdAt, target.response_time_minutes, plan).toISOString()
          slaResolutionDue = calculateSlaDeadline(createdAt, target.resolution_time_minutes, plan).toISOString()
        }
      }

      const { data: ticket } = await supabase
        .from('tickets')
        .insert({
          org_id: orgId,
          ticket_number: ticketNumber,
          customer_id: customerId,
          assigned_to: td.assigned_to ? memberByName[td.assigned_to] || null : null,
          category_id: categoryIds[td.category] || null,
          customer_contract_id: contractId,
          sla_plan_id: planToUse?.id || null,
          subject: td.subject,
          description: td.description,
          ticket_type: td.ticket_type,
          priority: td.priority,
          sla_response_due_at: slaResponseDue,
          sla_resolution_due_at: slaResolutionDue,
          site_location: td.site_location || null,
          room_number: td.room_number || null,
          device_details: td.device_details || null,
          portal_token: crypto.randomUUID(),
          created_by: user.id,
          created_at: createdAt.toISOString(),
        })
        .select('id')
        .single()

      if (!ticket) continue

      // Initial message
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'agent',
        sender_id: user.id,
        sender_name: `${user.firstName} ${user.lastName}`,
        body: td.description,
        is_internal: false,
        created_at: createdAt.toISOString(),
      })

      // SLA started event
      if (planToUse) {
        await supabase.from('sla_events').insert({
          ticket_id: ticket.id,
          event_type: 'started',
          event_data: { sla_plan_id: planToUse.id },
          created_at: createdAt.toISOString(),
        })
      }

      // Tags
      for (const tagName of td.tags) {
        if (tagIds[tagName]) {
          await supabase.from('ticket_tag_assignments').insert({
            ticket_id: ticket.id,
            tag_id: tagIds[tagName],
          })
        }
      }

      // Add a time entry to the first ticket
      if (seq === 2 && td.assigned_to) {
        await supabase.from('ticket_time_entries').insert({
          ticket_id: ticket.id,
          user_id: memberByName[td.assigned_to] || user.id,
          minutes: 25,
          description: 'Initial investigation and remote diagnostics',
          is_billable: true,
        })
      }
    }
  }

  // ======================================================================
  // 6. CANNED RESPONSES
  // ======================================================================
  const cannedData = [
    { title: 'Greeting — First Response', body: 'Hi,\n\nThank you for contacting PSD Group support. I\'m looking into this for you now and will update you shortly.\n\nRegards,\nPSD Support', category: 'Greeting' },
    { title: 'Password Reset Instructions', body: 'Hi,\n\nI\'ve reset your password. Your temporary password is: [TEMP_PASSWORD]\n\nPlease log in and change it immediately. If you have any issues, let me know.\n\nRegards,\nPSD Support', category: 'Account Access' },
    { title: 'Waiting for Information', body: 'Hi,\n\nThank you for your patience. To proceed with this issue, I need the following information:\n\n1. [DETAIL NEEDED]\n2. [DETAIL NEEDED]\n\nPlease reply at your earliest convenience.\n\nRegards,\nPSD Support', category: 'General' },
    { title: 'Resolution — Issue Fixed', body: 'Hi,\n\nGood news — the issue has been resolved. Here\'s what was done:\n\n[DESCRIPTION OF FIX]\n\nPlease test and confirm everything is working as expected. If you experience any further issues, don\'t hesitate to get in touch.\n\nRegards,\nPSD Support', category: 'Resolution' },
    { title: 'Onsite Visit Scheduled', body: 'Hi,\n\nI\'ve scheduled an onsite visit for [DATE] at [TIME]. Our engineer [NAME] will attend.\n\nPlease ensure someone is available to provide access. If this time doesn\'t suit, let us know and we\'ll rearrange.\n\nRegards,\nPSD Support', category: 'Onsite' },
  ]

  for (const cr of cannedData) {
    const { data: existing } = await supabase
      .from('canned_responses')
      .select('id')
      .eq('org_id', orgId)
      .eq('title', cr.title)
      .maybeSingle()

    if (!existing) {
      await supabase.from('canned_responses').insert({
        org_id: orgId,
        title: cr.title,
        body: cr.body,
        category: cr.category,
        is_shared: true,
        created_by: user.id,
      })
    }
  }

  // ======================================================================
  // 7. KB CATEGORIES & ARTICLES
  // ======================================================================
  const kbCategories = [
    { name: 'Getting Started', description: 'Onboarding and first steps', icon: '🚀' },
    { name: 'Email & Office 365', description: 'Email, Outlook, and Microsoft 365', icon: '📧' },
    { name: 'Network & Connectivity', description: 'Wi-Fi, VPN, and network troubleshooting', icon: '🌐' },
    { name: 'Hardware', description: 'PCs, laptops, printers, and peripherals', icon: '💻' },
    { name: 'Security', description: 'Passwords, MFA, and security best practices', icon: '🔒' },
  ]

  const kbCatIds: Record<string, string> = {}
  for (const kc of kbCategories) {
    const { data: existing } = await supabase
      .from('kb_categories')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', kc.name)
      .maybeSingle()

    if (existing) {
      kbCatIds[kc.name] = existing.id
    } else {
      const { data } = await supabase
        .from('kb_categories')
        .insert({ org_id: orgId, ...kc })
        .select('id')
        .single()
      if (data) kbCatIds[kc.name] = data.id
    }
  }

  const kbArticles = [
    {
      title: 'How to Reset Your Password',
      slug: 'how-to-reset-your-password',
      category: 'Security',
      body: '# How to Reset Your Password\n\n1. Go to https://portal.office.com\n2. Click "Can\'t access your account?"\n3. Enter your email address\n4. Follow the verification steps\n5. Create a new password (minimum 12 characters)\n\nIf you\'re still having trouble, contact PSD Support.',
      is_published: true,
    },
    {
      title: 'Setting Up VPN Access',
      slug: 'setting-up-vpn-access',
      category: 'Network & Connectivity',
      body: '# Setting Up VPN Access\n\n## Prerequisites\n- Active company account\n- Approved VPN access request\n\n## Steps\n1. Download the VPN client from the software portal\n2. Install and run the application\n3. Enter server: vpn.psdgroup.co.uk\n4. Use your company credentials\n5. Approve the MFA prompt',
      is_published: true,
    },
    {
      title: 'Connecting to the Printer',
      slug: 'connecting-to-the-printer',
      category: 'Hardware',
      body: '# Connecting to the Office Printer\n\n1. Open Settings > Printers & Scanners\n2. Click "Add a printer"\n3. Select the network printer from the list\n4. If not visible, enter: \\\\printserver\\MainPrinter\n5. Install the drivers when prompted\n\nDefault printer queue: MainPrinter-Colour',
      is_published: true,
    },
    {
      title: 'New Starter IT Checklist',
      slug: 'new-starter-it-checklist',
      category: 'Getting Started',
      body: '# New Starter IT Checklist\n\n- [ ] Active Directory account created\n- [ ] Email/O365 licence assigned\n- [ ] MFA enrolled\n- [ ] VPN access (if remote)\n- [ ] Line-of-business applications\n- [ ] Printer configured\n- [ ] Company phone set up\n- [ ] Induction training completed',
      is_published: true,
      is_internal: true,
    },
  ]

  for (const article of kbArticles) {
    const { data: existing } = await supabase
      .from('kb_articles')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', article.slug)
      .maybeSingle()

    if (!existing) {
      await supabase.from('kb_articles').insert({
        org_id: orgId,
        category_id: kbCatIds[article.category] || null,
        title: article.title,
        slug: article.slug,
        body: article.body,
        is_published: article.is_published,
        is_internal: article.is_internal || false,
        author_id: user.id,
      })
    }
  }

  // ======================================================================
  // 8. AI TRIAGE TAGS
  // ======================================================================
  const triageTagData = [
    { name: 'System Down', color: '#dc2626', is_ai_assignable: true },
    { name: 'Compromise', color: '#b91c1c', is_ai_assignable: true },
    { name: 'Virus/Malware', color: '#9333ea', is_ai_assignable: true },
    { name: 'Password Reset', color: '#0891b2', is_ai_assignable: true },
    { name: 'Hardware Failure', color: '#ea580c', is_ai_assignable: true },
    { name: 'Network Issue', color: '#ca8a04', is_ai_assignable: true },
    { name: 'New Starter', color: '#059669', is_ai_assignable: true },
    { name: 'Leaver', color: '#64748b', is_ai_assignable: true },
  ]

  const triageTagIds: Record<string, string> = {}
  for (const tag of triageTagData) {
    const { data: existing } = await supabase
      .from('ticket_tags')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', tag.name)
      .maybeSingle()

    if (existing) {
      triageTagIds[tag.name] = existing.id
      // Ensure existing tag is marked AI-assignable
      await supabase
        .from('ticket_tags')
        .update({ is_ai_assignable: true })
        .eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('ticket_tags')
        .insert({ org_id: orgId, ...tag })
        .select('id')
        .single()
      if (data) triageTagIds[tag.name] = data.id
    }
  }

  // ======================================================================
  // 9. EXAMPLE AUTOMATION MACRO
  // ======================================================================
  const compromiseTagId = triageTagIds['Compromise']
  if (compromiseTagId) {
    const { data: existingMacro } = await supabase
      .from('automation_macros')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', 'Compromise Alert')
      .maybeSingle()

    if (!existingMacro) {
      await supabase.from('automation_macros').insert({
        org_id: orgId,
        name: 'Compromise Alert',
        description: 'Auto-escalates tickets tagged as Compromise and notifies admins',
        trigger_type: 'tag_applied',
        trigger_conditions: { tag_ids: [compromiseTagId], match: 'any' },
        actions: [
          { type: 'escalate', level: 2 },
          { type: 'set_status', status: 'escalated' },
          { type: 'notify_roles', role_names: ['admin'] },
        ],
        created_by: user.id,
      })
    }
  }

  // ======================================================================
  // 10. HELEN AI SETTINGS
  // ======================================================================
  const helenDefaults: Record<string, string> = {
    helen_enabled: 'true',
    helen_persona: 'You are Helen, a friendly and professional IT support assistant for PSD Group. You are knowledgeable about IT infrastructure, Microsoft 365, networking, and general IT support. You always aim to be helpful, clear, and reassuring.',
    helen_guardrails: '- Never promise specific resolution times or SLA guarantees\n- Do not share internal pricing, contract details, or staff information\n- Do not attempt to diagnose security incidents — escalate immediately\n- Always recommend contacting PSD Support directly for urgent issues\n- Do not make up technical solutions — only suggest well-known troubleshooting steps',
    helen_ack_enabled: 'true',
    helen_ack_template: 'Hi {contact_name},\n\nThank you for contacting PSD Group support. Your ticket {ticket_number} has been logged and our team will be in touch shortly.\n\nSubject: {subject}\nPriority: {priority}\nReference: {ticket_number}\n\nRegards,\nPSD Support',
    helen_draft_enabled: 'true',
    helen_auto_send_needs_detail: 'false',
    helen_create_tags: 'false',
  }

  for (const [key, value] of Object.entries(helenDefaults)) {
    const { data: existing } = await supabase
      .from('org_settings')
      .select('id')
      .eq('org_id', orgId)
      .eq('setting_key', key)
      .maybeSingle()

    if (!existing) {
      await supabase.from('org_settings').insert({
        org_id: orgId,
        setting_key: key,
        setting_value: value,
        category: 'helen',
      })
    }
  }

  // Clean up old ai_triage_enabled setting if it exists (superseded by Helen)
  await supabase
    .from('org_settings')
    .delete()
    .eq('org_id', orgId)
    .eq('setting_key', 'ai_triage_enabled')

  // ======================================================================
  // 11. DEPARTMENTS
  // ======================================================================
  const departmentData = [
    { name: 'Service Desk', description: 'Frontline triage and first response', escalation_type: 'sideways', priority_uplift: 0, display_order: 0 },
    { name: 'Provisioning', description: 'Hardware and software provisioning', escalation_type: 'sideways', priority_uplift: 0, display_order: 1 },
    { name: 'Third Line', description: 'Advanced technical support', escalation_type: 'upward', priority_uplift: 1, display_order: 2 },
    { name: 'Sales', description: 'Commercial queries and renewals', escalation_type: 'sideways', priority_uplift: 0, display_order: 3 },
    { name: 'Management', description: 'Management escalation', escalation_type: 'upward', priority_uplift: 2, display_order: 4 },
  ]

  const deptIds: Record<string, string> = {}
  for (const dept of departmentData) {
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', dept.name)
      .maybeSingle()

    if (existing) {
      deptIds[dept.name] = existing.id
    } else {
      const { data } = await supabase
        .from('departments')
        .insert({ org_id: orgId, ...dept })
        .select('id')
        .single()
      if (data) deptIds[dept.name] = data.id
    }
  }

  // Fetch team members for department assignment
  const { data: allMembers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const memberByFullName: Record<string, string> = {}
  for (const m of allMembers || []) {
    memberByFullName[`${m.first_name} ${m.last_name}`] = m.id
  }

  const deptMemberAssignments: { dept: string; member: string; role: 'manager' | 'member' }[] = [
    { dept: 'Service Desk', member: 'Sam Hartley', role: 'manager' },
    { dept: 'Service Desk', member: 'Dan Whittle', role: 'member' },
    { dept: 'Provisioning', member: 'Dan Whittle', role: 'manager' },
    { dept: 'Provisioning', member: 'Sam Hartley', role: 'member' },
    { dept: 'Third Line', member: 'Steve Dixon', role: 'manager' },
    { dept: 'Third Line', member: 'Dan Whittle', role: 'member' },
    { dept: 'Sales', member: 'Mark Reynolds', role: 'manager' },
    { dept: 'Sales', member: 'Rachel Booth', role: 'member' },
    { dept: 'Sales', member: 'Jake Parry', role: 'member' },
    { dept: 'Management', member: 'Steve Dixon', role: 'manager' },
    { dept: 'Management', member: 'Lisa Greenwood', role: 'member' },
  ]

  for (const assignment of deptMemberAssignments) {
    const deptId = deptIds[assignment.dept]
    const userId = memberByFullName[assignment.member]
    if (!deptId || !userId) continue

    const { data: existing } = await supabase
      .from('department_members')
      .select('id')
      .eq('department_id', deptId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) {
      await supabase.from('department_members').insert({
        department_id: deptId,
        user_id: userId,
        role: assignment.role,
      })
    }
  }

  return { success: true }
}
