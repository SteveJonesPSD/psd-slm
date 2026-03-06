import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['super_admin', 'admin', 'sales']

const EXTRACTION_PROMPT = `You are extracting contact information from the provided content. This could be an email signature, a business card, a website "About Us" or "Contact" page, or any text containing a person's details.

Extract the following structured data. Return a JSON object with EXACTLY these field names:
{
  "first_name": "Person's first name",
  "last_name": "Person's last name",
  "job_title": "Their job title or role",
  "email": "Their email address",
  "phone": "Their direct/office phone number (not mobile)",
  "mobile": "Their mobile/cell phone number",
  "company_name": "The company or organisation they work for",
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find
- Use EXACTLY the field names shown above
- If only one phone number is found and it looks like a mobile (starts with 07 in UK, or +447), put it in "mobile". Otherwise put it in "phone"
- If there are multiple people, extract only the FIRST/MOST PROMINENT person
- For email signatures, the person who sent the email is the contact — ignore the "From:" or "To:" headers if present
- company_name should be the organisation, not a department
- confidence: "high" if most fields are clearly present, "medium" if some are ambiguous, "low" if very sparse
- Return ONLY valid JSON, no markdown fencing or commentary`

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!ALLOWED_ROLES.includes(user.role.name)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const pastedText = (body.text as string)?.trim() || null
    const imageBase64 = (body.image as string)?.trim() || null
    const imageType = (body.image_type as string)?.trim() || null

    if (!pastedText && !imageBase64) {
      return NextResponse.json({ error: 'Text or image is required' }, { status: 400 })
    }

    if (imageBase64) {
      const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      if (!imageType || !allowedImageTypes.includes(imageType)) {
        return NextResponse.json({ error: 'Invalid image type. Use PNG, JPEG, WebP, or GIF.' }, { status: 400 })
      }
      const approxBytes = imageBase64.length * 3 / 4
      if (approxBytes > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
      }
    }

    const supabase = await createClient()

    const { data: apiKeySetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', user.orgId)
      .eq('setting_key', 'anthropic_api_key')
      .single()

    const apiKey = (apiKeySetting?.setting_value as string | null) || process.env.ANTHROPIC_API_KEY || null

    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic API key not configured. Add it in Settings > API Keys.' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    let extracted: Record<string, unknown> | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = imageBase64
          ? [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: imageType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: imageBase64 } },
              { type: 'text' as const, text: EXTRACTION_PROMPT + '\n\nExtract contact information from this image (could be a screenshot of an email signature, business card, website, etc.).' },
            ]
          : `${EXTRACTION_PROMPT}\n\n--- CONTENT ---\n${pastedText!.substring(0, 8000)}`

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: messageContent }],
        })

        const textBlock = response.content.find((block) => block.type === 'text')
        if (!textBlock?.text) throw new Error('No text in response')

        let jsonStr = textBlock.text.trim()
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        extracted = JSON.parse(jsonStr) as Record<string, unknown>
        break
      } catch (err) {
        console.error(`[analyse-contact] Attempt ${attempt + 1} failed:`, err)
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    if (!extracted) {
      return NextResponse.json({ error: 'Failed to extract contact data. The content may not contain contact information.' }, { status: 400 })
    }

    const str = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = extracted![k]
        if (typeof v === 'string' && v.length > 0) return v
      }
      return null
    }

    const contactData = {
      first_name: str(['first_name']) || '',
      last_name: str(['last_name']) || '',
      job_title: str(['job_title', 'title', 'role']),
      email: str(['email', 'email_address']),
      phone: str(['phone', 'phone_number', 'office_phone', 'direct_phone']),
      mobile: str(['mobile', 'mobile_number', 'cell', 'cell_phone']),
      company_name: str(['company_name', 'company', 'organisation', 'organization']),
      confidence: (['high', 'medium', 'low'].includes(extracted.confidence as string) ? extracted.confidence : 'medium') as 'high' | 'medium' | 'low',
    }

    return NextResponse.json({ extracted: contactData })
  } catch (err) {
    console.error('[analyse-contact]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
