'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import type { Brand } from '@/types/database'

// --- Helpers ---

function requireAdmin(user: { role: { name: string } }) {
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }
}

// --- Organisation Settings ---

export async function getSettings(category?: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from('org_settings')
    .select('*')
    .eq('org_id', user.orgId)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) return { error: error.message }

  // Mask secret values
  const masked = (data || []).map((s) => ({
    ...s,
    setting_value: s.is_secret ? maskSecretValue(s.setting_value) : s.setting_value,
  }))

  return { data: masked }
}

function maskSecretValue(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  const str = String(value)
  if (str.length <= 11) return '••••••••'
  return str.substring(0, 7) + '...' + str.substring(str.length - 4)
}

export async function saveSettings(
  settings: { category: string; setting_key: string; setting_value: unknown; is_secret?: boolean; description?: string }[]
) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  for (const s of settings) {
    const { error } = await supabase
      .from('org_settings')
      .upsert(
        {
          org_id: user.orgId,
          category: s.category,
          setting_key: s.setting_key,
          setting_value: s.setting_value as string,
          is_secret: s.is_secret ?? false,
          description: s.description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,setting_key' }
      )

    if (error) return { error: `Failed to save ${s.setting_key}: ${error.message}` }
  }

  logActivity({
    supabase,
    user,
    entityType: 'org_settings',
    entityId: user.orgId,
    action: 'updated',
    details: { keys: settings.map((s) => s.setting_key) },
  })

  revalidatePath('/settings')
  // Revalidate layout if portal logo changed
  if (settings.some(s => s.setting_key === 'portal_logo_url')) {
    revalidatePath('/', 'layout')
  }
  return { success: true }
}

// --- Brands ---

export async function getBrands() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { error: error.message }
  return { data: data as Brand[] }
}

export async function getBrand(id: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error) return { error: error.message }
  return { data: data as Brand }
}

export async function saveBrand(
  brandData: Partial<Brand> & { name: string },
  brandId?: string
) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  // If setting as default, un-default all others first
  if (brandData.is_default) {
    await supabase
      .from('brands')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('org_id', user.orgId)
  }

  if (brandId) {
    // Update existing
    const { data, error } = await supabase
      .from('brands')
      .update({
        ...brandData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    logActivity({
      supabase,
      user,
      entityType: 'brand',
      entityId: brandId,
      action: 'updated',
      details: { name: brandData.name },
    })

    revalidatePath('/settings/brands')
    return { data }
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('brands')
      .insert({
        org_id: user.orgId,
        ...brandData,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    logActivity({
      supabase,
      user,
      entityType: 'brand',
      entityId: data.id,
      action: 'created',
      details: { name: brandData.name },
    })

    revalidatePath('/settings/brands')
    return { data }
  }
}

export async function deleteBrand(brandId: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  // Check if brand is referenced by quotes
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)

  if (count && count > 0) {
    return { error: `This brand is used on ${count} quote${count === 1 ? '' : 's'} and cannot be deleted. You can deactivate it instead.` }
  }

  // Get brand name for logging
  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', brandId)
    .single()

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', brandId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'brand',
    entityId: brandId,
    action: 'deleted',
    details: { name: brand?.name },
  })

  revalidatePath('/settings/brands')
  return { success: true }
}

export async function toggleBrandActive(brandId: string, isActive: boolean) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('brands')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', brandId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'brand',
    entityId: brandId,
    action: isActive ? 'activated' : 'deactivated',
  })

  revalidatePath('/settings/brands')
  return { success: true }
}

export async function setDefaultBrand(brandId: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  // Un-default all brands first
  await supabase
    .from('brands')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('org_id', user.orgId)

  // Set the chosen one
  const { error } = await supabase
    .from('brands')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', brandId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'brand',
    entityId: brandId,
    action: 'set_default',
  })

  revalidatePath('/settings/brands')
  return { success: true }
}

// --- Seed Data ---

export async function seedSettings() {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  // Seed org settings
  const defaultSettings = [
    { category: 'general', setting_key: 'org_name', setting_value: 'PSD Group', description: 'Organisation display name' },
    { category: 'general', setting_key: 'timezone', setting_value: 'Europe/London', description: 'Default timezone' },
    { category: 'general', setting_key: 'date_format', setting_value: 'DD/MM/YYYY', description: 'Date display format' },
    { category: 'general', setting_key: 'currency', setting_value: 'GBP', description: 'Default currency' },
    { category: 'general', setting_key: 'financial_year_start', setting_value: 'April', description: 'Financial year start month' },
    { category: 'general', setting_key: 'default_vat_rate', setting_value: '20', description: 'Default VAT rate percentage' },
    { category: 'general', setting_key: 'default_payment_terms', setting_value: '30', description: 'Default payment terms in days' },
    { category: 'email', setting_key: 'email_provider', setting_value: 'none', description: 'Email delivery provider' },
    { category: 'email', setting_key: 'email_from_name', setting_value: 'PSD Group', description: 'Default sender name' },
    { category: 'email', setting_key: 'quote_email_subject', setting_value: 'Quote {quote_number} from {brand_name}', description: 'Quote email subject template' },
    { category: 'email', setting_key: 'quote_email_body', setting_value: 'Dear {contact_name},\n\nPlease find attached our quote {quote_number} for your review.\n\nYou can also view and accept this quote online:\n{portal_url}\n\nThis quote is valid until {valid_until}.\n\nIf you have any questions, please don\'t hesitate to get in touch.\n\nKind regards,\n{brand_name}', description: 'Quote email body template' },
  ]

  for (const s of defaultSettings) {
    await supabase
      .from('org_settings')
      .upsert(
        {
          org_id: user.orgId,
          category: s.category,
          setting_key: s.setting_key,
          setting_value: s.setting_value,
          is_secret: false,
          description: s.description,
        },
        { onConflict: 'org_id,setting_key' }
      )
  }

  // Seed brands
  const defaultTerms = 'Quotes are valid based on the expiry date stated above, after which prices are subject to change without notice. Specifications may also change without notice. E. & O.E.'
  const defaultPaymentTermsText = 'Payment is due within the agreed payment terms from date of invoice.'

  // Check if PSD Group brand exists
  const { data: existingBrands } = await supabase
    .from('brands')
    .select('id, name')
    .eq('org_id', user.orgId)

  const psdExists = existingBrands?.find((b) => b.name === 'PSD Group')
  let psdBrandId: string

  if (!psdExists) {
    const { data: psdBrand } = await supabase
      .from('brands')
      .insert({
        org_id: user.orgId,
        name: 'PSD Group',
        legal_entity: 'PSD Technical Services Limited',
        is_default: true,
        is_active: true,
        quote_prefix: 'Q',
        footer_text: 'PSD Group, EnviroSentry & IngressaEdge are trading names of PSD Technical Services Limited',
        default_terms: defaultTerms,
        default_payment_terms_text: defaultPaymentTermsText,
      })
      .select()
      .single()

    psdBrandId = psdBrand!.id
  } else {
    psdBrandId = psdExists.id
  }

  const esExists = existingBrands?.find((b) => b.name === 'EnviroSentry')
  if (!esExists) {
    await supabase.from('brands').insert({
      org_id: user.orgId,
      name: 'EnviroSentry',
      legal_entity: 'PSD Technical Services Limited',
      is_default: false,
      is_active: false,
      quote_prefix: 'ES',
      footer_text: 'EnviroSentry is a trading name of PSD Technical Services Limited',
      default_terms: defaultTerms,
      default_payment_terms_text: defaultPaymentTermsText,
    })
  }

  // Update existing quotes without brand_id
  await supabase
    .from('quotes')
    .update({ brand_id: psdBrandId })
    .is('brand_id', null)

  revalidatePath('/settings')
  return { success: true, brandId: psdBrandId }
}

// --- Secret settings (full value, server-side only) ---

export async function getSecretSettingValue(settingKey: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', settingKey)
    .single()

  if (error) return null
  return data?.setting_value as string | null
}
