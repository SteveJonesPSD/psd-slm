'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export async function createSupplier(formData: FormData) {
  const user = await requirePermission('suppliers', 'create')
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Supplier name is required' }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      org_id: user.orgId,
      name,
      account_number: (formData.get('account_number') as string) || null,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      website: (formData.get('website') as string) || null,
      payment_terms: parseInt(formData.get('payment_terms') as string) || 30,
      notes: (formData.get('notes') as string) || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'supplier', entityId: data.id, action: 'created', details: { name } })
  revalidatePath('/suppliers')
  return { data }
}

export async function updateSupplier(id: string, formData: FormData) {
  const user = await requirePermission('suppliers', 'edit_all')
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Supplier name is required' }

  const isActiveStr = formData.get('is_active')
  const updates: Record<string, unknown> = {
    name,
    account_number: (formData.get('account_number') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    payment_terms: parseInt(formData.get('payment_terms') as string) || 30,
    notes: (formData.get('notes') as string) || null,
  }

  if (isActiveStr !== null) {
    updates.is_active = isActiveStr === 'true'
  }

  const { error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'supplier', entityId: id, action: 'updated', details: { name } })
  revalidatePath('/suppliers')
  revalidatePath(`/suppliers/${id}`)
  return { success: true }
}

export async function seedSuppliers() {
  const user = await requirePermission('suppliers', 'create')
  const supabase = await createClient()

  const seedData = [
    { name: 'Sensirion AG', account_number: 'SUP-001', email: 'orders@sensirion.com', phone: '+41 44 306 40 00', payment_terms: 30 },
    { name: 'Ubiquiti Networks', account_number: 'SUP-002', email: 'trade@ui.com', phone: '0800 123 4567', payment_terms: 30 },
    { name: 'Excel Networking', account_number: 'SUP-003', email: 'sales@excel-networking.com', phone: '0121 326 7557', payment_terms: 30 },
    { name: 'RS Components', account_number: 'SUP-004', email: 'orders@rs-online.com', phone: '01onal 403 2000', payment_terms: 30 },
    { name: 'Farnell', account_number: 'SUP-005', email: 'sales@farnell.com', phone: '0113 263 6311', payment_terms: 30 },
  ]

  const { error } = await supabase
    .from('suppliers')
    .insert(seedData.map((s) => ({ ...s, org_id: user.orgId })))

  if (error) return { error: error.message }

  revalidatePath('/suppliers')
  return { success: true }
}
