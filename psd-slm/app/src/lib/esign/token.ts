import { createAdminClient } from '@/lib/supabase/admin'
import type { EsignRequest } from './types'

/**
 * Builds the public-facing signing URL for a given token.
 */
export function buildSigningUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/sign/${token}`
}

/**
 * Checks if an e-sign request has expired based on its expiresAt timestamp.
 */
export function isRequestExpired(request: EsignRequest): boolean {
  return new Date(request.expiresAt) < new Date()
}

/**
 * Expires all pending e-sign requests that have passed their expiresAt.
 * Called by cron or on-demand. Returns count of expired records.
 */
export async function expireStaleRequests(): Promise<number> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('contract_esign_requests')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('[esign-token] Failed to expire stale requests:', error.message)
    return 0
  }

  return data?.length ?? 0
}
