'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export async function createCategory(formData: FormData) {
  const user = await requirePermission('products', 'create')
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Category name is required' }

  // Get max sort_order
  const { data: existing } = await supabase
    .from('product_categories')
    .select('sort_order')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      org_id: user.orgId,
      name,
      requires_serial: formData.get('requires_serial') === 'true',
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_category', entityId: data.id, action: 'created', details: { name } })
  revalidatePath('/products/categories')
  return { data }
}

export async function updateCategory(id: string, formData: FormData) {
  const user = await requirePermission('products', 'edit_all')
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Category name is required' }

  const { error } = await supabase
    .from('product_categories')
    .update({
      name,
      requires_serial: formData.get('requires_serial') === 'true',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_category', entityId: id, action: 'updated', details: { name } })
  revalidatePath('/products/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const user = await requirePermission('products', 'delete')
  const supabase = await createClient()

  // Check for products in this category
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return { error: `This category contains ${count} product${count === 1 ? '' : 's'}. Move them to another category first.` }
  }

  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_category', entityId: id, action: 'deleted' })
  revalidatePath('/products/categories')
  return { success: true }
}

export async function reorderCategories(orderedIds: string[]) {
  const user = await requirePermission('products', 'edit_all')
  const supabase = await createClient()

  // Batch update sort_order
  const updates = orderedIds.map((id, i) =>
    supabase.from('product_categories').update({ sort_order: i }).eq('id', id)
  )

  await Promise.all(updates)
  revalidatePath('/products/categories')
  return { success: true }
}

export async function seedCategories() {
  const user = await requirePermission('products', 'create')
  const supabase = await createClient()

  const seedData = [
    { name: 'Environmental Sensors', requires_serial: true, sort_order: 0 },
    { name: 'Networking', requires_serial: true, sort_order: 1 },
    { name: 'Access Control', requires_serial: true, sort_order: 2 },
    { name: 'Cabling & Infrastructure', requires_serial: false, sort_order: 3 },
    { name: 'Software & Licensing', requires_serial: false, sort_order: 4 },
  ]

  const { error } = await supabase
    .from('product_categories')
    .insert(seedData.map((s) => ({ ...s, org_id: user.orgId })))

  if (error) return { error: error.message }

  revalidatePath('/products/categories')
  return { success: true }
}
