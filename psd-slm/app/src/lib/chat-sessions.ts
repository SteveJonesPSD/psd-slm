'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, requirePermission } from '@/lib/auth'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  agentId: string
  messages: ChatMessage[]
  updatedAt: string
}

export interface ArchivedChat {
  sessionId: string
  agentId: string
  userId: string
  firstName: string
  lastName: string
  email: string
  initials: string | null
  color: string | null
  messageCount: number
  firstMessage: string | null
  createdAt: string
  updatedAt: string
  isArchived: boolean
}

export interface ArchivedChatDetail {
  session: ArchivedChat
  messages: { role: string; content: string; createdAt: string }[]
}

// ─── User-facing actions ────────────────────────────────────────────────

/**
 * Load the current (non-archived) chat session for a given agent.
 */
export async function loadChatSession(agentId: string): Promise<ChatSession | null> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, agent_id, updated_at')
    .eq('user_id', user.id)
    .eq('agent_id', agentId)
    .eq('is_archived', false)
    .single()

  if (!session) return null

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  return {
    id: session.id,
    agentId: session.agent_id,
    messages: (messages || []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    updatedAt: session.updated_at,
  }
}

/**
 * Load all non-archived chat sessions for the current user (ChatPanel restore).
 */
export async function loadAllChatSessions(): Promise<Record<string, ChatMessage[]>> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id, agent_id')
    .eq('user_id', user.id)
    .eq('is_archived', false)

  if (!sessions || sessions.length === 0) return {}

  const result: Record<string, ChatMessage[]> = {}

  for (const session of sessions) {
    const { data: messages } = await supabase
      .from('chat_messages')
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

/**
 * Append a pair of messages (user + assistant) to a session.
 * Creates the session if it doesn't exist.
 */
export async function appendChatMessages(
  agentId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const user = await requireAuth()
  const supabase = await createClient()

  // Find existing active session
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('agent_id', agentId)
    .eq('is_archived', false)
    .single()

  let sessionId: string

  if (existing) {
    sessionId = existing.id
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  } else {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        org_id: user.orgId,
        agent_id: agentId,
        is_archived: false,
      })
      .select('id')
      .single()

    if (!newSession) return
    sessionId = newSession.id
  }

  // Insert both messages
  await supabase.from('chat_messages').insert([
    { session_id: sessionId, role: 'user', content: userMessage },
    { session_id: sessionId, role: 'assistant', content: assistantMessage },
  ])
}

/**
 * Clear a chat session — archives it (preserves for admin audit) and starts fresh.
 */
export async function clearChatSession(agentId: string): Promise<void> {
  const user = await requireAuth()
  const supabase = await createClient()

  // Archive the current session (mark as archived, messages stay intact)
  await supabase
    .from('chat_sessions')
    .update({ is_archived: true })
    .eq('user_id', user.id)
    .eq('agent_id', agentId)
    .eq('is_archived', false)
}

// ─── Admin-facing actions (Settings > Chat Archive) ──────────────────────

/**
 * Get all chat sessions (active + archived) for the organisation.
 * Admin/Super Admin only.
 */
export async function getChatArchive(filters?: {
  agentId?: string
  userId?: string
  archivedOnly?: boolean
}): Promise<ArchivedChat[]> {
  const user = await requirePermission('settings', 'view')
  const adminClient = createAdminClient()

  let query = adminClient
    .from('v_chat_archive')
    .select('*')
    .eq('org_id', user.orgId)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (filters?.agentId) {
    query = query.eq('agent_id', filters.agentId)
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }
  if (filters?.archivedOnly) {
    query = query.eq('is_archived', true)
  }

  const { data } = await query

  return (data || []).map((row) => ({
    sessionId: row.session_id,
    agentId: row.agent_id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    initials: row.initials,
    color: row.color,
    messageCount: row.message_count,
    firstMessage: row.first_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isArchived: row.is_archived,
  }))
}

/**
 * Get full message thread for a specific chat session.
 * Admin/Super Admin only.
 */
export async function getChatArchiveDetail(sessionId: string): Promise<ArchivedChatDetail | null> {
  const user = await requirePermission('settings', 'view')
  const adminClient = createAdminClient()

  // Get session info
  const { data: session } = await adminClient
    .from('v_chat_archive')
    .select('*')
    .eq('session_id', sessionId)
    .eq('org_id', user.orgId)
    .single()

  if (!session) return null

  // Get messages
  const { data: messages } = await adminClient
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return {
    session: {
      sessionId: session.session_id,
      agentId: session.agent_id,
      userId: session.user_id,
      firstName: session.first_name,
      lastName: session.last_name,
      email: session.email,
      initials: session.initials,
      color: session.color,
      messageCount: session.message_count,
      firstMessage: session.first_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      isArchived: session.is_archived,
    },
    messages: (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  }
}
