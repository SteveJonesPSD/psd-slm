import { NextRequest, NextResponse } from 'next/server'
import { getPortalContextFromRequest } from '@/lib/portal/session'
import {
  loadPortalChatSessions,
  appendPortalChatMessages,
  clearPortalChatSession,
} from '@/lib/portal/chat-sessions'

export async function GET(request: NextRequest) {
  const ctx = await getPortalContextFromRequest(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const sessions = await loadPortalChatSessions(ctx)
  return NextResponse.json(sessions)
}

export async function POST(request: NextRequest) {
  const ctx = await getPortalContextFromRequest(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { action, agentId, userMessage, assistantMessage } = await request.json()

  if (action === 'append' && agentId && userMessage && assistantMessage) {
    await appendPortalChatMessages(agentId, userMessage, assistantMessage, ctx)
    return NextResponse.json({ success: true })
  }

  if (action === 'clear' && agentId) {
    await clearPortalChatSession(agentId, ctx)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
