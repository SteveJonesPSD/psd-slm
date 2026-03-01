'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { OPPORTUNITY_STAGE_CONFIG, type OpportunityStage } from '@/lib/opportunities'

// --- Create ---

export async function createOpportunity(formData: FormData) {
  const user = await requirePermission('pipeline', 'create')
  const supabase = await createClient()

  const title = (formData.get('title') as string)?.trim()
  const customer_id = formData.get('customer_id') as string

  if (!title) return { error: 'Title is required' }
  if (!customer_id) return { error: 'Customer is required' }

  const stage = (formData.get('stage') as string) || 'prospecting'
  const probability = formData.get('probability') !== null
    ? Number(formData.get('probability'))
    : OPPORTUNITY_STAGE_CONFIG[stage as OpportunityStage]?.defaultProbability ?? 10

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      org_id: user.orgId,
      customer_id,
      contact_id: (formData.get('contact_id') as string) || null,
      assigned_to: (formData.get('assigned_to') as string) || user.id,
      title,
      stage,
      estimated_value: formData.get('estimated_value') ? Number(formData.get('estimated_value')) : null,
      probability,
      expected_close_date: (formData.get('expected_close_date') as string) || null,
      notes: (formData.get('notes') as string) || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'opportunity',
    entityId: data.id,
    action: 'created',
    details: { title, customer_id, stage },
  })

  revalidatePath('/pipeline')
  return { data }
}

// --- Update ---

export async function updateOpportunity(id: string, formData: FormData) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'pipeline', 'edit_all')
  const canEditOwn = hasPermission(user, 'pipeline', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: pipeline.edit')
  const supabase = await createClient()

  // Fetch old values for change diff
  const { data: old } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (!old) return { error: 'Opportunity not found' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Title is required' }
  if (!formData.get('customer_id')) return { error: 'Customer is required' }

  const updates = {
    customer_id: formData.get('customer_id') as string,
    contact_id: (formData.get('contact_id') as string) || null,
    assigned_to: (formData.get('assigned_to') as string) || null,
    title,
    stage: (formData.get('stage') as string) || old.stage,
    estimated_value: formData.get('estimated_value') ? Number(formData.get('estimated_value')) : null,
    probability: formData.get('probability') !== null ? Number(formData.get('probability')) : old.probability,
    expected_close_date: (formData.get('expected_close_date') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }

  const { error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }

  // Build change diff
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, val] of Object.entries(updates)) {
    const oldVal = old[key as keyof typeof old]
    if (String(val ?? '') !== String(oldVal ?? '')) {
      changes[key] = { from: oldVal, to: val }
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'opportunity',
    entityId: id,
    action: 'updated',
    details: { title, changes },
  })

  revalidatePath('/pipeline')
  revalidatePath(`/opportunities/${id}`)
  return { success: true }
}

// --- Change Stage ---

export async function changeStage(
  id: string,
  newStage: string,
  probability: number,
  lostReason?: string | null
) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'pipeline', 'edit_all')
  const canEditOwn = hasPermission(user, 'pipeline', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: pipeline.edit')
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('opportunities')
    .select('stage, title, probability')
    .eq('id', id)
    .single()

  if (!current) return { error: 'Opportunity not found' }

  const update: Record<string, unknown> = {
    stage: newStage,
    probability,
  }
  if (newStage === 'lost' && lostReason) {
    update.lost_reason = lostReason
  }
  if (newStage === 'won') {
    update.lost_reason = null
  }

  const { error } = await supabase
    .from('opportunities')
    .update(update)
    .eq('id', id)

  if (error) return { error: error.message }

  let action = 'stage_changed'
  if (newStage === 'won') action = 'won'
  if (newStage === 'lost') action = 'lost'

  logActivity({
    supabase,
    user,
    entityType: 'opportunity',
    entityId: id,
    action,
    details: {
      title: current.title,
      from_stage: current.stage,
      to_stage: newStage,
      probability,
      ...(lostReason ? { lost_reason: lostReason } : {}),
    },
  })

  revalidatePath('/pipeline')
  revalidatePath(`/opportunities/${id}`)
  return { success: true }
}

// --- Delete ---

export async function deleteOpportunity(id: string) {
  const user = await requirePermission('pipeline', 'delete')
  const supabase = await createClient()

  const { data: opp } = await supabase
    .from('opportunities')
    .select('title')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'opportunity',
    entityId: id,
    action: 'deleted',
    details: { title: opp?.title },
  })

  revalidatePath('/pipeline')
  return { success: true }
}

// --- Update Notes ---

export async function updateNotes(id: string, notes: string) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'pipeline', 'edit_all')
  const canEditOwn = hasPermission(user, 'pipeline', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: pipeline.edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('opportunities')
    .update({ notes: notes || null })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'opportunity',
    entityId: id,
    action: 'updated',
    details: { field: 'notes' },
  })

  revalidatePath(`/opportunities/${id}`)
  return { success: true }
}

// --- Seed Data ---

export async function seedOpportunities() {
  const user = await requirePermission('pipeline', 'create')
  const supabase = await createClient()

  // Idempotent check
  const { count } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)

  if (count && count > 0) {
    return { error: 'Opportunities already exist. Seed skipped to prevent duplicates.' }
  }

  // Fetch lookups
  const [{ data: customers }, { data: contacts }, { data: users }] = await Promise.all([
    supabase.from('customers').select('id, name').eq('org_id', user.orgId),
    supabase.from('contacts').select('id, customer_id, first_name, last_name'),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId),
  ])

  const findCustomer = (name: string) => customers?.find((c) => c.name.includes(name))
  const findContact = (customerId: string) => contacts?.find((c) => c.customer_id === customerId)
  const findUser = (firstName: string) => users?.find((u) => u.first_name === firstName)?.id

  const mark = findUser('Mark')
  const rachel = findUser('Rachel')
  const jake = findUser('Jake')

  const seeds: Record<string, unknown>[] = []

  // 1. Prospecting
  const meridian = findCustomer('Meridian')
  if (meridian) {
    seeds.push({
      org_id: user.orgId,
      customer_id: meridian.id,
      contact_id: findContact(meridian.id)?.id || null,
      assigned_to: mark || user.id,
      title: 'Meridian Academy — Network Refresh',
      stage: 'prospecting',
      estimated_value: 28500,
      probability: 10,
      expected_close_date: '2026-06-30',
      notes: 'Initial conversation about replacing ageing network switches across 3 sites.',
    })
  }

  // 2. Qualifying
  const northern = findCustomer('Northern')
  if (northern) {
    seeds.push({
      org_id: user.orgId,
      customer_id: northern.id,
      contact_id: findContact(northern.id)?.id || null,
      assigned_to: rachel || user.id,
      title: 'Northern Health — Environmental Monitoring',
      stage: 'qualifying',
      estimated_value: 45000,
      probability: 25,
      expected_close_date: '2026-05-15',
      notes: 'NHS trust interested in Sensirion-based air quality monitoring across 12 wards.',
    })
  }

  // 3. Proposal
  const hartwell = findCustomer('Hartwell')
  if (hartwell) {
    seeds.push({
      org_id: user.orgId,
      customer_id: hartwell.id,
      contact_id: findContact(hartwell.id)?.id || null,
      assigned_to: mark || user.id,
      title: 'Hartwell Properties — Structured Cabling',
      stage: 'proposal',
      estimated_value: 67000,
      probability: 50,
      expected_close_date: '2026-04-20',
      notes: 'Full Cat6A cabling for new office building. Quote sent, awaiting feedback.',
    })
  }

  // 4. Negotiation
  const pennine = findCustomer('Pennine')
  if (pennine) {
    seeds.push({
      org_id: user.orgId,
      customer_id: pennine.id,
      contact_id: findContact(pennine.id)?.id || null,
      assigned_to: jake || user.id,
      title: 'Pennine Leisure — WiFi Upgrade',
      stage: 'negotiation',
      estimated_value: 34000,
      probability: 75,
      expected_close_date: '2026-03-28',
      notes: 'Ubiquiti WiFi 6 rollout across 8 hotel sites. Negotiating volume discount.',
    })
  }

  // 5. Another proposal
  if (pennine) {
    seeds.push({
      org_id: user.orgId,
      customer_id: pennine.id,
      contact_id: findContact(pennine.id)?.id || null,
      assigned_to: rachel || user.id,
      title: 'Pennine Leisure — CCTV Upgrade',
      stage: 'proposal',
      estimated_value: 22000,
      probability: 50,
      expected_close_date: '2026-05-10',
      notes: 'Quote submitted for IP camera system across main reception areas.',
    })
  }

  // 6. Prospecting
  const crestwood = findCustomer('Crestwood')
  if (crestwood) {
    seeds.push({
      org_id: user.orgId,
      customer_id: crestwood.id,
      contact_id: findContact(crestwood.id)?.id || null,
      assigned_to: rachel || user.id,
      title: 'Crestwood Grammar — CCTV & Access Control',
      stage: 'prospecting',
      estimated_value: 18500,
      probability: 10,
      expected_close_date: '2026-07-31',
    })
  }

  // 7. Won
  if (meridian) {
    seeds.push({
      org_id: user.orgId,
      customer_id: meridian.id,
      contact_id: findContact(meridian.id)?.id || null,
      assigned_to: mark || user.id,
      title: 'Meridian Academy — Classroom AV Install',
      stage: 'won',
      estimated_value: 15200,
      probability: 100,
      expected_close_date: '2026-02-15',
      notes: 'Completed — interactive displays and speakers for 10 classrooms.',
    })
  }

  // 8. Lost
  if (northern) {
    seeds.push({
      org_id: user.orgId,
      customer_id: northern.id,
      contact_id: findContact(northern.id)?.id || null,
      assigned_to: rachel || user.id,
      title: 'Northern Health — Server Migration',
      stage: 'lost',
      estimated_value: 52000,
      probability: 0,
      expected_close_date: '2026-01-31',
      lost_reason: 'Chose competitor',
      notes: 'Lost to incumbent provider. They matched our price with existing SLA.',
    })
  }

  // 9. Qualifying
  if (hartwell) {
    seeds.push({
      org_id: user.orgId,
      customer_id: hartwell.id,
      contact_id: findContact(hartwell.id)?.id || null,
      assigned_to: jake || user.id,
      title: 'Hartwell Properties — Firewall Replacement',
      stage: 'qualifying',
      estimated_value: 12800,
      probability: 25,
      expected_close_date: '2026-05-30',
    })
  }

  if (seeds.length === 0) {
    return { error: 'No customers found. Please seed customers first.' }
  }

  let created = 0
  for (const seed of seeds) {
    const { error } = await supabase.from('opportunities').insert(seed)
    if (!error) created++
  }

  revalidatePath('/pipeline')
  return { success: true, created }
}
