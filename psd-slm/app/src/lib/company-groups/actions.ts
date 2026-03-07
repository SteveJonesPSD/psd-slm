'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { CompanyGroup, CompanyGroupMember, GroupType, BillingModel } from '@/types/company-groups'
import { GROUP_MEMBER_COLOURS } from '@/types/company-groups'

// ─── READ ────────────────────────────────────────────────────────────

export async function getCompanyGroups(): Promise<CompanyGroup[]> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_groups')
    .select(`
      *,
      customers!company_groups_parent_company_id_fkey(id, name, account_number),
      company_group_members(id)
    `)
    .eq('org_id', user.orgId)
    .order('name')

  if (error) throw new Error(error.message)

  return (data || []).map((g: Record<string, unknown>) => ({
    ...g,
    parent_company: g.customers as CompanyGroup['parent_company'],
    member_count: ((g.company_group_members as { id: string }[]) || []).length,
    customers: undefined,
    company_group_members: undefined,
  })) as unknown as CompanyGroup[]
}

export async function getCompanyGroup(groupId: string): Promise<CompanyGroup | null> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_groups')
    .select(`
      *,
      customers!company_groups_parent_company_id_fkey(id, name, account_number),
      company_group_members(
        id, org_id, group_id, company_id, colour, display_order, created_at,
        customers(id, name, account_number)
      )
    `)
    .eq('id', groupId)
    .eq('org_id', user.orgId)
    .single()

  if (error || !data) return null

  const members = ((data.company_group_members as Record<string, unknown>[]) || [])
    .map((m) => ({
      ...m,
      company: m.customers as CompanyGroupMember['company'],
      customers: undefined,
    }))
    .sort((a, b) => ((a as Record<string, unknown>).display_order as number) - ((b as Record<string, unknown>).display_order as number))

  return {
    ...data,
    parent_company: data.customers as CompanyGroup['parent_company'],
    members: members as unknown as CompanyGroupMember[],
    customers: undefined,
    company_group_members: undefined,
  } as unknown as CompanyGroup
}

export async function getGroupForCompany(companyId: string): Promise<{
  asParent: CompanyGroup | null
  asMembers: CompanyGroup[]
}> {
  const user = await requireAuth()
  const supabase = await createClient()

  // Check if this company is a group parent
  const { data: parentGroup } = await supabase
    .from('company_groups')
    .select(`
      *,
      customers!company_groups_parent_company_id_fkey(id, name, account_number),
      company_group_members(
        id, org_id, group_id, company_id, colour, display_order, created_at,
        customers(id, name, account_number)
      )
    `)
    .eq('parent_company_id', companyId)
    .eq('org_id', user.orgId)
    .single()

  let asParent: CompanyGroup | null = null
  if (parentGroup) {
    const members = ((parentGroup.company_group_members as Record<string, unknown>[]) || [])
      .map((m) => ({
        ...m,
        company: m.customers as CompanyGroupMember['company'],
        customers: undefined,
      }))
      .sort((a, b) => ((a as Record<string, unknown>).display_order as number) - ((b as Record<string, unknown>).display_order as number))

    asParent = {
      ...parentGroup,
      parent_company: parentGroup.customers as CompanyGroup['parent_company'],
      members: members as unknown as CompanyGroupMember[],
      customers: undefined,
      company_group_members: undefined,
    } as unknown as CompanyGroup
  }

  // Check if this company is a member of any groups
  const { data: memberLinks } = await supabase
    .from('company_group_members')
    .select(`
      group_id,
      colour,
      company_groups(
        *,
        customers!company_groups_parent_company_id_fkey(id, name, account_number)
      )
    `)
    .eq('company_id', companyId)
    .eq('org_id', user.orgId)

  const asMembers: CompanyGroup[] = (memberLinks || []).map((link: Record<string, unknown>) => {
    const g = link.company_groups as Record<string, unknown>
    return {
      ...g,
      parent_company: g.customers as CompanyGroup['parent_company'],
      customers: undefined,
    } as unknown as CompanyGroup
  })

  return { asParent, asMembers }
}

export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('company_group_members')
    .select('company_id')
    .eq('group_id', groupId)
    .eq('org_id', user.orgId)

  return (data || []).map((r: { company_id: string }) => r.company_id)
}

// ─── WRITE ───────────────────────────────────────────────────────────

export async function createCompanyGroup(data: {
  name: string
  parent_company_id: string
  group_type: GroupType
  billing_model: BillingModel
  notes?: string
}): Promise<{ data?: CompanyGroup; error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  const { data: group, error } = await supabase
    .from('company_groups')
    .insert({
      org_id: user.orgId,
      name: data.name,
      parent_company_id: data.parent_company_id,
      group_type: data.group_type,
      billing_model: data.billing_model,
      notes: data.notes || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This company is already the parent of a group' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'company_group', entityId: group.id, action: 'created', details: { name: data.name } })
  revalidatePath('/customers')
  return { data: group as CompanyGroup }
}

export async function updateCompanyGroup(
  groupId: string,
  data: Partial<{
    name: string
    group_type: GroupType
    billing_model: BillingModel
    notes: string
    is_active: boolean
  }>
): Promise<{ data?: CompanyGroup; error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  const { data: group, error } = await supabase
    .from('company_groups')
    .update(data)
    .eq('id', groupId)
    .eq('org_id', user.orgId)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'company_group', entityId: groupId, action: 'updated', details: data })
  revalidatePath('/customers')
  return { data: group as CompanyGroup }
}

export async function addGroupMember(
  groupId: string,
  companyId: string,
  colour?: string
): Promise<{ data?: CompanyGroupMember; error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  // Verify the group exists and get parent_company_id
  const { data: group } = await supabase
    .from('company_groups')
    .select('id, parent_company_id')
    .eq('id', groupId)
    .eq('org_id', user.orgId)
    .single()

  if (!group) return { error: 'Group not found' }
  if (group.parent_company_id === companyId) return { error: 'Cannot add the parent company as a member' }

  // Auto-assign colour if not specified
  let assignedColour = colour
  if (!assignedColour) {
    const { data: existing } = await supabase
      .from('company_group_members')
      .select('colour')
      .eq('group_id', groupId)

    const usedColours = new Set((existing || []).map((m: { colour: string }) => m.colour))
    assignedColour = GROUP_MEMBER_COLOURS.find(c => !usedColours.has(c)) || GROUP_MEMBER_COLOURS[0]
  }

  // Get next display_order
  const { data: maxOrder } = await supabase
    .from('company_group_members')
    .select('display_order')
    .eq('group_id', groupId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = maxOrder ? maxOrder.display_order + 1 : 0

  const { data: member, error } = await supabase
    .from('company_group_members')
    .insert({
      org_id: user.orgId,
      group_id: groupId,
      company_id: companyId,
      colour: assignedColour,
      display_order: nextOrder,
    })
    .select(`*, customers(id, name, account_number)`)
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This company is already a member of this group' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'company_group_member', entityId: member.id, action: 'added', details: { groupId, companyId } })
  revalidatePath('/customers')

  return {
    data: {
      ...member,
      company: member.customers as CompanyGroupMember['company'],
      customers: undefined,
    } as unknown as CompanyGroupMember,
  }
}

export async function removeGroupMember(memberId: string): Promise<{ error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  const { error } = await supabase
    .from('company_group_members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'company_group_member', entityId: memberId, action: 'removed' })
  revalidatePath('/customers')
  return {}
}

export async function updateMemberColour(memberId: string, colour: string): Promise<{ error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  const { error } = await supabase
    .from('company_group_members')
    .update({ colour })
    .eq('id', memberId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function updateMemberOrder(groupId: string, orderedMemberIds: string[]): Promise<{ error?: string }> {
  const user = await requirePermission('companies', 'manage_groups')
  const supabase = await createClient()

  for (let i = 0; i < orderedMemberIds.length; i++) {
    const { error } = await supabase
      .from('company_group_members')
      .update({ display_order: i })
      .eq('id', orderedMemberIds[i])
      .eq('group_id', groupId)
      .eq('org_id', user.orgId)

    if (error) return { error: error.message }
  }

  revalidatePath('/customers')
  return {}
}

// ─── PORTAL HELPERS ──────────────────────────────────────────────────

/**
 * Get group data for a portal group admin.
 * Uses admin client since portal users don't have Supabase Auth sessions.
 */
export async function getPortalGroupForParent(parentCompanyId: string, orgId: string): Promise<CompanyGroup | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('company_groups')
    .select(`
      *,
      customers!company_groups_parent_company_id_fkey(id, name, account_number),
      company_group_members(
        id, org_id, group_id, company_id, colour, display_order, created_at,
        customers(id, name, account_number)
      )
    `)
    .eq('parent_company_id', parentCompanyId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .single()

  if (!data) return null

  const members = ((data.company_group_members as Record<string, unknown>[]) || [])
    .map((m) => ({
      ...m,
      company: m.customers as CompanyGroupMember['company'],
      customers: undefined,
    }))
    .sort((a, b) => ((a as Record<string, unknown>).display_order as number) - ((b as Record<string, unknown>).display_order as number))

  return {
    ...data,
    parent_company: data.customers as CompanyGroup['parent_company'],
    members: members as unknown as CompanyGroupMember[],
    customers: undefined,
    company_group_members: undefined,
  } as unknown as CompanyGroup
}
