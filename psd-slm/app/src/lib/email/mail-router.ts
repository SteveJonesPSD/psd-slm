// =============================================================================
// Mail Router
// Maps channel handler names to handler functions.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessedEmail, MailChannel, HandlerResult } from './types'
import { handleHelpdeskEmail } from './handlers/helpdesk'

type HandlerFn = (
  email: ProcessedEmail,
  channel: MailChannel,
  orgId: string,
  supabase: SupabaseClient
) => Promise<HandlerResult>

const HANDLERS: Record<string, HandlerFn> = {
  helpdesk: handleHelpdeskEmail,
  // Future: purchasing, sales
}

export function getHandler(handlerName: string): HandlerFn | null {
  return HANDLERS[handlerName] || null
}
