// =============================================================================
// Scenario Email Handler
// Adapter between mail router and the AI scenario engine.
// =============================================================================

import type { ProcessedEmail, HandlerResult } from '../types'
import { runScenarioEngine } from '../scenario-engine'

export async function handleScenarioEmail(
  orgId: string,
  channelId: string,
  channelName: string,
  mailboxAddress: string,
  email: ProcessedEmail,
  contact: { id: string; name: string; email: string; customer_name: string } | null
): Promise<HandlerResult> {
  try {
    await runScenarioEngine({ orgId, channelId, channelName, mailboxAddress, message: email, contact })
    return { action: 'created_ticket', notes: 'Processed by scenario engine' }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ScenarioHandler] Error:', errorMessage)
    return { action: 'error', notes: `Scenario engine error: ${errorMessage}` }
  }
}
