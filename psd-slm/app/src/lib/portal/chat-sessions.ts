'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext } from './types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function loadPortalChatSessions(
  ctx: PortalContext
): Promise<Record<string, ChatMessage[]>> {
  const supabase = createAdminClient()

  const { data: sessions } = await supabase
    .from('portal_chat_sessions')
    .select('id, agent_id')
    .eq('portal_user_id', ctx.portalUserId)
    .eq('is_archived', false)

  if (!sessions || sessions.length === 0) return {}

  const result: Record<string, ChatMessage[]> = {}

  for (const session of sessions) {
    const { data: messages } = await supabase
      .from('portal_chat_messages')
      .select('role, content')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (messages && messages.length > 0) {
      result[session.agent_id] = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    }
  }

  return result
}

export async function appendPortalChatMessages(
  agentId: string,
  userMessage: string,
  assistantMessage: string,
  ctx: PortalContext
): Promise<void> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('portal_chat_sessions')
    .select('id')
    .eq('portal_user_id', ctx.portalUserId)
    .eq('agent_id', agentId)
    .eq('is_archived', false)
    .single()

  let sessionId: string

  if (existing) {
    sessionId = existing.id
    await supabase
      .from('portal_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  } else {
    const { data: newSession } = await supabase
      .from('portal_chat_sessions')
      .insert({
        portal_user_id: ctx.portalUserId,
        agent_id: agentId,
        customer_id: ctx.customerId,
        org_id: ctx.orgId,
      })
      .select('id')
      .single()

    if (!newSession) return
    sessionId = newSession.id
  }

  await supabase.from('portal_chat_messages').insert([
    { session_id: sessionId, role: 'user', content: userMessage },
    { session_id: sessionId, role: 'assistant', content: assistantMessage },
  ])
}

export async function clearPortalChatSession(
  agentId: string,
  ctx: PortalContext
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('portal_chat_sessions')
    .update({ is_archived: true })
    .eq('portal_user_id', ctx.portalUserId)
    .eq('agent_id', agentId)
    .eq('is_archived', false)
}
