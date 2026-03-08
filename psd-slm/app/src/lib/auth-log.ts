import { createAdminClient } from '@/lib/supabase/admin'

export type AuthEventType =
  | 'login_success' | 'login_failure' | 'logout' | 'session_expired'
  | 'mfa_success' | 'mfa_failure'
  | 'passkey_registered' | 'passkey_auth_success' | 'passkey_auth_failure' | 'passkey_deleted'
  | 'magic_link_requested' | 'magic_link_used'
  | 'password_reset_requested' | 'password_changed'
  | 'portal_login_success' | 'portal_login_failure'

export type AuthMethod = 'password' | 'passkey' | 'magic_link' | 'mfa_totp' | 'password_passkey'

interface LogAuthEventParams {
  orgId?: string | null
  userId?: string | null
  portalUserId?: string | null
  eventType: AuthEventType
  authMethod?: AuthMethod | null
  success?: boolean
  failureReason?: string | null
  request?: Request | null
}

/**
 * Log an authentication event to auth_events.
 * Fire-and-forget — never throws, never blocks.
 * Uses admin client to bypass RLS (auth events are written before session exists).
 */
export async function logAuthEvent(params: LogAuthEventParams): Promise<void> {
  try {
    const {
      orgId, userId, portalUserId, eventType,
      authMethod, success = true, failureReason, request
    } = params

    let ipTruncated: string | null = null
    let userAgentClass: string | null = null

    if (request) {
      const rawIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        null
      if (rawIp) {
        ipTruncated = truncateIp(rawIp)
      }

      const rawUa = request.headers.get('user-agent') ?? ''
      userAgentClass = classifyUserAgent(rawUa)
    }

    const supabase = createAdminClient()
    await supabase.from('auth_events').insert({
      org_id: orgId ?? null,
      user_id: userId ?? null,
      portal_user_id: portalUserId ?? null,
      event_type: eventType,
      auth_method: authMethod ?? null,
      success,
      failure_reason: failureReason ?? null,
      ip_truncated: ipTruncated,
      user_agent_class: userAgentClass,
    })
  } catch {
    // Silently swallow — audit failure must never block auth flow
  }
}

/** Zero the last octet of an IPv4, or last group of an IPv6 */
function truncateIp(ip: string): string {
  if (ip.includes(':')) {
    const parts = ip.split(':')
    parts[parts.length - 1] = '0'
    return parts.join(':')
  }
  const parts = ip.split('.')
  if (parts.length === 4) {
    parts[3] = '0'
    return parts.join('.')
  }
  return ip
}

/** Classify UA into a short readable string — never return raw UA */
function classifyUserAgent(ua: string): string {
  const lower = ua.toLowerCase()

  let browser = 'Unknown'
  if (lower.includes('edg/')) browser = 'Edge'
  else if (lower.includes('chrome')) browser = 'Chrome'
  else if (lower.includes('firefox')) browser = 'Firefox'
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari'

  let os = 'Unknown'
  if (lower.includes('windows')) os = 'Windows'
  else if (lower.includes('mac os x')) os = 'macOS'
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS'
  else if (lower.includes('android')) os = 'Android'
  else if (lower.includes('linux')) os = 'Linux'

  return `${browser}/${os}`
}
