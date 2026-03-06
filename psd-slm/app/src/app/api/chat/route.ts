import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getSystemPrompt } from '@/lib/ai/system-prompt'
import { getToolsForUser, executeTool } from '@/lib/ai/tools'
import type { AuthUser } from '@/lib/auth'
import type { ChatRequest, ChatMessage } from '@/lib/ai/types'

const MAX_TOOL_ROUNDS = 5
const MAX_MESSAGES = 20

async function getApiUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AuthUser | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, email, first_name, last_name, initials, color, avatar_url, must_change_password, role_id, roles(id, name, display_name)')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  if (!appUser) return null

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', appUser.role_id)

  const role = appUser.roles as unknown as { id: string; name: string; display_name: string }
  const permissions = (rolePerms || []).map((rp) => {
    const perm = rp.permissions as unknown as { module: string; action: string }
    return `${perm.module}.${perm.action}`
  })

  return {
    id: appUser.id,
    authId: authUser.id,
    orgId: appUser.org_id,
    email: appUser.email,
    firstName: appUser.first_name,
    lastName: appUser.last_name,
    initials: appUser.initials,
    color: appUser.color,
    avatarUrl: appUser.avatar_url ?? null,
    themePreference: 'system',
    viewPreferences: {},
    mustChangePassword: appUser.must_change_password,
    role: {
      id: role.id,
      name: role.name,
      displayName: role.display_name,
    },
    permissions,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getApiUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages: chatMessages, pageContext } = body
  if (!chatMessages || !Array.isArray(chatMessages) || !pageContext) {
    return NextResponse.json({ error: 'Missing messages or pageContext' }, { status: 400 })
  }

  // Trim to last N messages
  const trimmed = chatMessages.slice(-MAX_MESSAGES)

  const systemPrompt = getSystemPrompt(user, pageContext)
  const tools = getToolsForUser(user.permissions, user.role.name)

  // Build Anthropic message history
  const anthropicMessages: Anthropic.Messages.MessageParam[] = trimmed.map((m: ChatMessage) => ({
    role: m.role,
    content: m.content,
  }))

  const client = new Anthropic({ apiKey })

  let rounds = 0
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: anthropicMessages,
    })

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const textBlock = response.content.find((b) => b.type === 'text')
      const text = textBlock && textBlock.type === 'text' ? textBlock.text : 'No response generated.'

      const reply: ChatMessage = {
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json({ message: reply })
    }

    if (response.stop_reason === 'tool_use') {
      // Append assistant message with tool use blocks
      anthropicMessages.push({
        role: 'assistant',
        content: response.content,
      })

      // Execute each tool call
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
        response.content
          .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
          .map(async (toolUse) => {
            const result = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              supabase,
              user.role.name
            )
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: result,
            }
          })
      )

      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      })

      continue
    }

    // Unexpected stop reason — return whatever text we have
    const fallbackText = response.content.find((b) => b.type === 'text')
    const reply: ChatMessage = {
      role: 'assistant',
      content: fallbackText && fallbackText.type === 'text' ? fallbackText.text : 'I encountered an issue processing your request.',
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json({ message: reply })
  }

  // Exhausted tool rounds
  const reply: ChatMessage = {
    role: 'assistant',
    content: 'I needed to look up more data than expected. Could you try a more specific question?',
    timestamp: new Date().toISOString(),
  }
  return NextResponse.json({ message: reply })
}
