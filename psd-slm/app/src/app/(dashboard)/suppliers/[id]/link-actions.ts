'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export async function linkProduct(formData: FormData) {
  const user = await requirePermission('suppliers', 'edit_all')
  const supabase = await createClient()

  const productId = formData.get('product_id') as string
  const supplierId = formData.get('supplier_id') as string
  const isPreferred = formData.get('is_preferred') === 'true'
  const costStr = formData.get('standard_cost') as string
  const leadStr = formData.get('lead_time_days') as string

  // If setting as preferred, unset existing preferred for this product
  if (isPreferred) {
    await supabase
      .from('product_suppliers')
      .update({ is_preferred: false })
      .eq('product_id', productId)
      .eq('is_preferred', true)
  }

  const { data, error } = await supabase
    .from('product_suppliers')
    .insert({
      product_id: productId,
      supplier_id: supplierId,
      supplier_sku: (formData.get('supplier_sku') as string) || null,
      standard_cost: costStr ? parseFloat(costStr) : null,
      lead_time_days: leadStr ? parseInt(leadStr) : null,
      is_preferred: isPreferred,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This product-supplier link already exists.' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: data.id, action: 'created', details: { productId, supplierId } })
  revalidatePath(`/suppliers/${supplierId}`)
  revalidatePath(`/products/${productId}`)
  return { data }
}

export async function updateProductSupplier(id: string, productId: string, formData: FormData) {
  const user = await requirePermission('suppliers', 'edit_all')
  const supabase = await createClient()

  const isPreferred = formData.get('is_preferred') === 'true'
  const costStr = formData.get('standard_cost') as string
  const leadStr = formData.get('lead_time_days') as string

  // If setting as preferred, unset existing preferred for this product
  if (isPreferred) {
    await supabase
      .from('product_suppliers')
      .update({ is_preferred: false })
      .eq('product_id', productId)
      .eq('is_preferred', true)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('product_suppliers')
    .update({
      supplier_sku: (formData.get('supplier_sku') as string) || null,
      standard_cost: costStr ? parseFloat(costStr) : null,
      lead_time_days: leadStr ? parseInt(leadStr) : null,
      is_preferred: isPreferred,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: id, action: 'updated', details: { productId } })
  revalidatePath('/suppliers')
  revalidatePath('/products')
  return { success: true }
}

export async function removeProductSupplier(id: string, productId: string) {
  const user = await requirePermission('suppliers', 'edit_all')
  const supabase = await createClient()

  const { error } = await supabase
    .from('product_suppliers')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: id, action: 'deleted', details: { productId } })
  revalidatePath('/suppliers')
  revalidatePath('/products')
  return { success: true }
}
