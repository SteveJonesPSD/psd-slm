// =============================================================================
// Mail Router
// Maps channel handler names to handler functions.
// Non-helpdesk channels fall through to the AI scenario engine.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessedEmail, MailChannel, HandlerResult } from './types'
import { handleHelpdeskEmail } from './handlers/helpdesk'
import { handleScenarioEmail } from './handlers/scenario'
import { resolveContactAndCustomer } from './contact-resolution'

type HandlerFn = (
  email: ProcessedEmail,
  channel: MailChannel,
  orgId: string,
  supabase: SupabaseClient
) => Promise<HandlerResult>

const HANDLERS: Record<string, HandlerFn> = {
  helpdesk: handleHelpdeskEmail,
}

/**
 * Create a scenario-engine handler for non-helpdesk channels.
 * Resolves the sender contact before passing to the scenario engine.
 */
function createScenarioHandler(): HandlerFn {
  return async (email, channel, orgId, supabase) => {
    const msg = email.graphMessage
    const fromAddress = (msg.from?.emailAddress?.address || '').trim().toLowerCase()
    const fromName = msg.from?.emailAddress?.name || fromAddress

    // Resolve contact using the same logic as helpdesk
    let contact: { id: string; name: string; email: string; customer_name: string } | null = null
    try {
      const resolution = await resolveContactAndCustomer(fromAddress, fromName, orgId, supabase)
      if (resolution.contact && resolution.customer) {
        contact = {
          id: resolution.contact.id,
          name: `${resolution.contact.first_name} ${resolution.contact.last_name}`.trim(),
          email: fromAddress,
          customer_name: resolution.customer.name,
        }
      }
    } catch {
      // Contact resolution failure is non-fatal — scenario engine handles null contacts
    }

    return handleScenarioEmail(
      orgId,
      channel.id,
      channel.display_name || channel.mailbox_address,
      channel.mailbox_address,
      email,
      contact
    )
  }
}

export function getHandler(handlerName: string): HandlerFn | null {
  // Known handlers take priority
  if (HANDLERS[handlerName]) {
    return HANDLERS[handlerName]
  }

  // All other channel types fall through to the scenario engine
  return createScenarioHandler()
}
