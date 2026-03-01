import { SupabaseClient } from '@supabase/supabase-js'
import { AuthUser } from '@/lib/auth'

interface LogActivityParams {
  supabase: SupabaseClient
  user: AuthUser
  entityType: string
  entityId: string
  action: string
  details?: Record<string, unknown>
}

/**
 * Fire-and-forget activity logger.
 * Never blocks the response — errors are logged server-side only.
 */
export function logActivity({
  supabase,
  user,
  entityType,
  entityId,
  action,
  details,
}: LogActivityParams): void {
  supabase
    .from('activity_log')
    .insert({
      org_id: user.orgId,
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      action,
      details: details ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[activity-log]', error.message)
    })
}
