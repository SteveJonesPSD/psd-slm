'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { getXeroClient, EngageXeroClient } from './xero-client'
import { logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getXeroSettings() {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .in('setting_key', ['xero_enabled', 'xero_push_mode', 'xero_credentials'])

  const map = Object.fromEntries(
    (data ?? []).map(s => [s.setting_key, s.setting_value as string])
  )

  let credentials = { client_id: '', client_secret: '', tenant_id: '' }
  if (map.xero_credentials) {
    try {
      const parsed = JSON.parse(map.xero_credentials)
      credentials = {
        client_id: parsed.client_id ?? '',
        client_secret: parsed.client_secret ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '',
        tenant_id: parsed.tenant_id ?? '',
      }
    } catch { /* ignore parse errors */ }
  }

  return {
    enabled: map.xero_enabled === 'true',
    push_mode: (map.xero_push_mode as 'auto' | 'manual') ?? 'manual',
    credentials,
    is_configured: !!(map.xero_credentials),
  }
}

export async function saveXeroSettings(formData: {
  enabled: boolean
  push_mode: 'auto' | 'manual'
  client_id: string
  client_secret: string
  tenant_id: string
}) {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }

  const supabase = await createClient()

  const settingsToSave: { category: string; setting_key: string; setting_value: string; is_secret: boolean; description: string }[] = [
    {
      category: 'integrations',
      setting_key: 'xero_enabled',
      setting_value: String(formData.enabled),
      is_secret: false,
      description: 'Enable Xero invoice sync',
    },
    {
      category: 'integrations',
      setting_key: 'xero_push_mode',
      setting_value: formData.push_mode,
      is_secret: false,
      description: 'Xero push mode: auto or manual',
    },
  ]

  // Only update credentials if client_secret doesn't look masked
  if (formData.client_secret && !formData.client_secret.startsWith('\u2022')) {
    settingsToSave.push({
      category: 'integrations',
      setting_key: 'xero_credentials',
      setting_value: JSON.stringify({
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        tenant_id: formData.tenant_id,
      }),
      is_secret: true,
      description: 'Xero API credentials (encrypted)',
    })
  }

  for (const s of settingsToSave) {
    await supabase
      .from('org_settings')
      .upsert(
        {
          org_id: user.orgId,
          category: s.category,
          setting_key: s.setting_key,
          setting_value: s.setting_value,
          is_secret: s.is_secret,
          description: s.description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,setting_key' }
      )
  }

  logActivity({
    supabase,
    user,
    entityType: 'settings',
    entityId: 'xero',
    action: 'settings.xero_updated',
    details: { enabled: formData.enabled, push_mode: formData.push_mode },
  })

  revalidatePath('/settings/integrations/xero')
  return { success: true }
}

export async function testXeroConnection(overrideCredentials?: {
  client_id: string
  client_secret: string
  tenant_id: string
}) {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }

  let client: EngageXeroClient

  if (overrideCredentials && overrideCredentials.client_secret && !overrideCredentials.client_secret.startsWith('\u2022')) {
    client = new EngageXeroClient(overrideCredentials)
  } else {
    const c = await getXeroClient(user.orgId)
    if (!c) return { success: false, error: 'Xero is not configured' }
    client = c
  }

  return await client.testConnection()
}

// ─── Push Actions ─────────────────────────────────────────────────────────────

/**
 * Push a single invoice to Xero. Fire-and-forget safe.
 */
export async function pushInvoiceToXero(invoiceId: string, orgId: string): Promise<{
  success: boolean
  error?: string
}> {
  const client = await getXeroClient(orgId)
  if (!client) return { success: false, error: 'Xero not configured or not enabled' }

  // Mark as pending first
  const adminSupabase = createAdminClient()
  await adminSupabase
    .from('invoices')
    .update({ xero_status: 'pending' })
    .eq('id', invoiceId)

  const result = await client.pushInvoice(invoiceId)

  // Log the push
  const supabase = await createClient()
  const user = await requireAuth()
  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: invoiceId,
    action: result.success ? 'invoice.xero_pushed' : 'invoice.xero_push_failed',
    details: { xero_invoice_id: result.xero_invoice_id, error: result.error },
  })

  return result
}

/**
 * Push a batch of invoices. Returns per-invoice results.
 */
export async function pushInvoicesBatch(invoiceIds: string[]): Promise<{
  results: { invoiceId: string; success: boolean; error?: string }[]
  successCount: number
  failCount: number
}> {
  const user = await requireAuth()
  if (!['super_admin', 'admin', 'finance'].includes(user.role.name)) {
    throw new Error('Access denied')
  }

  const client = await getXeroClient(user.orgId)
  if (!client) {
    return {
      results: invoiceIds.map(id => ({ invoiceId: id, success: false, error: 'Xero not configured' })),
      successCount: 0,
      failCount: invoiceIds.length,
    }
  }

  // Mark all as pending
  const adminSupabase = createAdminClient()
  await adminSupabase
    .from('invoices')
    .update({ xero_status: 'pending' })
    .in('id', invoiceIds)

  // Push sequentially to avoid rate limiting
  const results = []
  const supabase = await createClient()

  for (const invoiceId of invoiceIds) {
    const result = await client.pushInvoice(invoiceId)
    results.push({ invoiceId, ...result })

    logActivity({
      supabase,
      user,
      entityType: 'invoice',
      entityId: invoiceId,
      action: result.success ? 'invoice.xero_pushed' : 'invoice.xero_push_failed',
      details: { xero_invoice_id: result.xero_invoice_id, error: result.error },
    })
  }

  revalidatePath('/invoices')

  return {
    results,
    successCount: results.filter(r => r.success).length,
    failCount: results.filter(r => !r.success).length,
  }
}

/**
 * Check if Xero is enabled for the current org. Used by UI to conditionally render Xero features.
 */
export async function isXeroEnabled(): Promise<boolean> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'xero_enabled')
    .single()

  return data?.setting_value === 'true'
}

/**
 * Get Xero push mode for the current org.
 */
export async function getXeroPushMode(): Promise<'auto' | 'manual' | null> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', user.orgId)
    .eq('setting_key', 'xero_push_mode')
    .single()

  return (data?.setting_value as 'auto' | 'manual') ?? null
}

/**
 * Get Xero sync stats for the settings page.
 */
export async function getXeroSyncStats() {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }

  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('xero_status, xero_pushed_at')
    .eq('org_id', user.orgId)
    .eq('status', 'sent')

  const all = invoices ?? []
  const synced = all.filter(i => i.xero_status === 'synced').length
  const failed = all.filter(i => i.xero_status === 'failed').length
  const notPushed = all.filter(i => !i.xero_status).length

  // Most recent push
  const pushed = all.filter(i => i.xero_pushed_at).sort((a, b) =>
    new Date(b.xero_pushed_at!).getTime() - new Date(a.xero_pushed_at!).getTime()
  )
  const lastPushedAt = pushed[0]?.xero_pushed_at ?? null

  return { synced, failed, notPushed, lastPushedAt }
}
