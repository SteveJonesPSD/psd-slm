'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export async function linkSupplier(formData: FormData) {
  const user = await requirePermission('products', 'edit_all')
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

  const urlStr = (formData.get('url') as string) || null

  const { data, error } = await supabase
    .from('product_suppliers')
    .insert({
      product_id: productId,
      supplier_id: supplierId,
      supplier_sku: (formData.get('supplier_sku') as string) || null,
      standard_cost: costStr ? parseFloat(costStr) : null,
      lead_time_days: leadStr ? parseInt(leadStr) : null,
      is_preferred: isPreferred,
      url: urlStr,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This product-supplier link already exists.' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: data.id, action: 'created', details: { productId, supplierId } })
  revalidatePath(`/products/${productId}`)
  revalidatePath(`/suppliers/${supplierId}`)
  return { data }
}

export async function updateProductSupplierLink(id: string, productId: string, formData: FormData) {
  const user = await requirePermission('products', 'edit_all')
  const supabase = await createClient()

  const isPreferred = formData.get('is_preferred') === 'true'
  const costStr = formData.get('standard_cost') as string
  const leadStr = formData.get('lead_time_days') as string

  if (isPreferred) {
    await supabase
      .from('product_suppliers')
      .update({ is_preferred: false })
      .eq('product_id', productId)
      .eq('is_preferred', true)
      .neq('id', id)
  }

  const urlStr = (formData.get('url') as string) || null

  const { error } = await supabase
    .from('product_suppliers')
    .update({
      supplier_sku: (formData.get('supplier_sku') as string) || null,
      standard_cost: costStr ? parseFloat(costStr) : null,
      lead_time_days: leadStr ? parseInt(leadStr) : null,
      is_preferred: isPreferred,
      url: urlStr,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: id, action: 'updated', details: { productId } })
  revalidatePath('/products')
  revalidatePath('/suppliers')
  return { success: true }
}

export async function removeProductSupplierLink(id: string, productId: string) {
  const user = await requirePermission('products', 'edit_all')
  const supabase = await createClient()

  const { error } = await supabase
    .from('product_suppliers')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'product_supplier', entityId: id, action: 'deleted', details: { productId } })
  revalidatePath('/products')
  revalidatePath('/suppliers')
  return { success: true }
}
