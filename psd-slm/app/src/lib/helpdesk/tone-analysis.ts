import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ToneAnalysisResult } from '@/types/database'

const SYSTEM_PROMPT = `You are AutoGRUMP, a customer tone analyst for a UK IT support company.
Analyse the customer's messages for frustration, anger, or dissatisfaction.

Consider these signals:
- Repeated mentions of the same unresolved issue
- Escalation language ("still", "again", "yet again", "how many times")
- Urgency/deadline pressure ("need this today", "critical", "urgent")
- ALL CAPS usage, excessive exclamation marks
- Sarcasm or passive-aggressive tone
- Threats (escalation to manager, leaving, formal complaints)
- Contrast with earlier messages — is tone getting worse?
- British understatement patterns ("I'm a bit disappointed" often means "I'm furious")

Score meanings:
1 = Positive/grateful — customer is happy or satisfied
2 = Neutral — business-as-usual, no emotional charge
3 = Mildly frustrated — hints of impatience but still polite
4 = Frustrated — clearly unhappy, patience wearing thin
5 = Angry — hostile, demanding, threatening, or aggressive

Trend meanings:
- "escalating" — tone is getting worse across messages
- "stable" — tone is consistent
- "improving" — tone is getting better
- "new" — only one message to analyse (not enough history for trend)

Respond ONLY with JSON, no preamble:
{"score": <1-5>, "trend": "<escalating|stable|improving|new>", "summary": "<one line, max 100 chars>"}`

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

export async function analyseCustomerTone(ticketId: string): Promise<ToneAnalysisResult | null> {
  const supabase = createAdminClient()

  // Check if AutoGRUMP is enabled
  const { data: settingRow } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('category', 'helen')
    .eq('setting_key', 'autogrump_enabled')
    .maybeSingle()

  // Default to true if no setting exists
  if (settingRow?.setting_value === 'false') return null

  // Get the ticket's org_id
  const { data: ticket } = await supabase
    .from('tickets')
    .select('org_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return null

  // Fetch last 3 customer messages
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('body')
    .eq('ticket_id', ticketId)
    .eq('sender_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!messages || messages.length < 2) return null

  // Get API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Build user message
  const messageTexts = messages.map((m, i) => {
    const label = i === 0 ? 'Message 1 (latest)' : `Message ${i + 1}`
    return `${label}: """\n${stripHtml(m.body)}\n"""`
  })

  const userMessage = `Analyse these customer messages (most recent first):\n\n${messageTexts.join('\n\n')}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const score = Number(parsed.score)
    const trend = String(parsed.trend)
    const summary = String(parsed.summary || '').slice(0, 200)

    if (score < 1 || score > 5) return null
    if (!['escalating', 'stable', 'improving', 'new'].includes(trend)) return null

    const result: ToneAnalysisResult = {
      score,
      trend: trend as ToneAnalysisResult['trend'],
      summary,
    }

    // Write to ticket
    await supabase
      .from('tickets')
      .update({
        tone_score: result.score,
        tone_trend: result.trend,
        tone_summary: result.summary,
        tone_updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)

    return result
  } catch (err) {
    console.error('AutoGRUMP analysis error:', err)
    return null
  }
}
