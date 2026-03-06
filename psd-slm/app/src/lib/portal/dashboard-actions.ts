'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext } from './types'

export interface PortalDashboardData {
  openTickets: number
  pendingQuotes: number
  unpaidInvoices: number
  upcomingVisits: number
  activeContracts: number
  recentActivity: {
    type: 'ticket' | 'quote' | 'visit' | 'order' | 'invoice'
    description: string
    date: string
    link: string
  }[]
}

export async function getPortalDashboard(ctx: PortalContext): Promise<PortalDashboardData> {
  const supabase = createAdminClient()

  // Run all queries in parallel
  const [ticketsResult, quotesResult, invoicesResult, contractsResult, visitsResult, recentTickets, recentQuotes, recentInvoices] =
    await Promise.all([
      // Open tickets
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .not('status', 'in', '("resolved","closed","cancelled")'),

      // Pending quotes (sent, awaiting acceptance)
      supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .eq('status', 'sent'),

      // Unpaid invoices (sent but not paid — includes overdue)
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .eq('status', 'sent'),

      // Active contracts
      supabase
        .from('customer_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .eq('status', 'active'),

      // Upcoming visits (next 30 days) — via contracts
      (async () => {
        const { data: contracts } = await supabase
          .from('customer_contracts')
          .select('id')
          .eq('customer_id', ctx.customerId)
          .eq('status', 'active')

        if (!contracts || contracts.length === 0) return { count: 0 }

        const now = new Date().toISOString().split('T')[0]
        const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

        const { count } = await supabase
          .from('visit_instances')
          .select('id', { count: 'exact', head: true })
          .in('customer_contract_id', contracts.map((c) => c.id))
          .gte('visit_date', now)
          .lte('visit_date', thirtyDays)

        return { count: count || 0 }
      })(),

      // Recent ticket updates (for activity feed)
      supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, updated_at')
        .eq('customer_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .order('updated_at', { ascending: false })
        .limit(5),

      // Recent quote changes
      supabase
        .from('quotes')
        .select('id, quote_number, status, updated_at')
        .eq('company_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .in('status', ['sent', 'accepted', 'declined', 'expired'])
        .order('updated_at', { ascending: false })
        .limit(5),

      // Recent invoices
      supabase
        .from('invoices')
        .select('id, invoice_number, status, total, updated_at')
        .eq('customer_id', ctx.customerId)
        .eq('org_id', ctx.orgId)
        .neq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

  // Build activity feed
  const activity: PortalDashboardData['recentActivity'] = []

  for (const t of recentTickets.data || []) {
    activity.push({
      type: 'ticket',
      description: `${t.ticket_number}: ${t.subject} (${t.status})`,
      date: t.updated_at,
      link: `/portal/helpdesk/${t.id}`,
    })
  }

  for (const q of recentQuotes.data || []) {
    activity.push({
      type: 'quote',
      description: `${q.quote_number} — ${q.status}`,
      date: q.updated_at,
      link: `/portal/quotes/${q.id}`,
    })
  }

  for (const inv of recentInvoices.data || []) {
    activity.push({
      type: 'invoice',
      description: `${inv.invoice_number} — ${inv.status} (£${Number(inv.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })})`,
      date: inv.updated_at,
      link: `/portal/invoices/${inv.id}`,
    })
  }

  // Sort by date descending, take top 10
  activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    openTickets: ticketsResult.count || 0,
    pendingQuotes: quotesResult.count || 0,
    unpaidInvoices: invoicesResult.count || 0,
    upcomingVisits: (visitsResult as { count: number }).count || 0,
    activeContracts: contractsResult.count || 0,
    recentActivity: activity.slice(0, 10),
  }
}

// ============================================================
// Schedule & Contract Summary for Dashboard
// ============================================================

export interface PortalDashboardVisit {
  id: string
  visitDate: string
  timeSlot: string | null
  startTime: string | null
  endTime: string | null
  status: string
  engineerNames: string[]
  contractType: string | null
}

export interface PortalContractSummary {
  id: string
  contractNumber: string
  contractType: string
  status: string
  visitSlots: {
    dayOfWeek: string
    timeSlot: string
    timeDisplay: string
    engineerName: string | null
    cycleWeekNumbers: number[]
  }[]
}

const DAY_NAMES: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
}

const TIME_SLOT_LABELS: Record<string, string> = {
  am: 'AM (08:30–12:00)',
  pm: 'PM (12:30–16:00)',
  custom: 'Custom',
}

export async function getPortalDashboardSchedule(ctx: PortalContext): Promise<{
  upcomingVisits: PortalDashboardVisit[]
  contracts: PortalContractSummary[]
}> {
  const supabase = createAdminClient()

  // Get active contracts with type info and visit slots
  const { data: contracts } = await supabase
    .from('customer_contracts')
    .select(`
      id, contract_number, status,
      contract_types(name),
      contract_visit_slots(day_of_week, time_slot, cycle_week_numbers, default_start_time, default_end_time, override_start_time, override_end_time, engineer_id, users:engineer_id(first_name, last_name))
    `)
    .eq('customer_id', ctx.customerId)
    .eq('org_id', ctx.orgId)
    .eq('status', 'active')

  if (!contracts || contracts.length === 0) {
    return { upcomingVisits: [], contracts: [] }
  }

  const contractIds = contracts.map((c) => c.id)
  const contractTypeMap = new Map(
    contracts.map((c) => [
      c.id,
      (c.contract_types as unknown as { name: string })?.name || null,
    ])
  )

  // Get upcoming visits (next 8 weeks)
  const now = new Date().toISOString().split('T')[0]
  const eightWeeks = new Date(Date.now() + 56 * 86400000).toISOString().split('T')[0]

  const { data: visits } = await supabase
    .from('visit_instances')
    .select(`
      id, visit_date, time_slot, start_time, end_time, status, customer_contract_id, engineer_id,
      users!visit_instances_engineer_id_fkey(first_name, last_name)
    `)
    .in('customer_contract_id', contractIds)
    .gte('visit_date', now)
    .lte('visit_date', eightWeeks)
    .in('status', ['draft', 'confirmed'])
    .order('visit_date', { ascending: true })

  const upcomingVisits: PortalDashboardVisit[] = (visits || []).map((v) => {
    const user = v.users as unknown as { first_name: string; last_name: string } | null
    return {
      id: v.id,
      visitDate: v.visit_date,
      timeSlot: v.time_slot || null,
      startTime: v.start_time || null,
      endTime: v.end_time || null,
      status: v.status,
      engineerNames: user ? [`${user.first_name} ${user.last_name}`] : [],
      contractType: v.customer_contract_id ? contractTypeMap.get(v.customer_contract_id) || null : null,
    }
  })

  const contractSummaries: PortalContractSummary[] = contracts.map((c) => {
    const typeName = (c.contract_types as unknown as { name: string })?.name || 'Unknown'
    const slots = (c.contract_visit_slots || []) as unknown as {
      day_of_week: string
      time_slot: string
      cycle_week_numbers: number[] | null
      default_start_time: string | null
      default_end_time: string | null
      override_start_time: string | null
      override_end_time: string | null
      users: { first_name: string; last_name: string } | null
    }[]

    return {
      id: c.id,
      contractNumber: c.contract_number,
      contractType: typeName,
      status: c.status,
      visitSlots: slots.map((s) => {
        const start = (s.override_start_time || s.default_start_time || '')?.slice(0, 5)
        const end = (s.override_end_time || s.default_end_time || '')?.slice(0, 5)
        const timeDisplay = start && end ? `${start} – ${end}` : TIME_SLOT_LABELS[s.time_slot] || s.time_slot
        return {
          dayOfWeek: DAY_NAMES[s.day_of_week] || s.day_of_week,
          timeSlot: s.time_slot,
          timeDisplay,
          engineerName: s.users ? `${s.users.first_name} ${s.users.last_name}` : null,
          cycleWeekNumbers: s.cycle_week_numbers || [],
        }
      }),
    }
  })

  return { upcomingVisits, contracts: contractSummaries }
}
