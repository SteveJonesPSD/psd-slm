import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['super_admin', 'admin', 'sales']

const EXTRACTION_PROMPT = `You are extracting company/organisation information from the provided content. This could be a screenshot of a website, an email signature, a business card, or any text containing company details.

Extract the following structured data. Return a JSON object with EXACTLY these field names:
{
  "company_name": "The company or organisation name",
  "customer_type": "education|business|charity",
  "address_line1": "First line of address (street/building)",
  "address_line2": "Second line of address (area/locality)",
  "city": "City or town",
  "county": "County or region",
  "postcode": "UK postcode",
  "phone": "Main company phone number",
  "email": "General company email address",
  "website": "Company website URL",
  "vat_number": "VAT registration number if shown",
  "contact_first_name": "Primary contact's first name",
  "contact_last_name": "Primary contact's last name",
  "contact_job_title": "Primary contact's job title",
  "contact_email": "Primary contact's email address",
  "contact_phone": "Primary contact's direct phone (not mobile)",
  "contact_mobile": "Primary contact's mobile number",
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find
- Use EXACTLY the field names shown above
- customer_type: "education" for schools, colleges, universities, academies, trusts (MATs); "charity" for registered charities, non-profits; "business" for everything else. Default to "business" if unclear
- For email signatures: the company name is usually in the signature block, the person is the primary contact
- If the content has a company phone AND a person's direct phone, put the company phone in "phone" and the person's in "contact_phone"
- If only one phone is found and there's a person, put it in "contact_phone" and leave "phone" null
- If a mobile number is found (UK: starts with 07 or +447), put it in "contact_mobile"
- website should include the protocol (https://) — add it if not present
- For UK postcodes, format them correctly with a space (e.g. "OL16 4RN")
- confidence: "high" if company name and at least 2 other fields found, "medium" if sparse, "low" if very ambiguous
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
              { type: 'text' as const, text: EXTRACTION_PROMPT + '\n\nExtract company and contact information from this image (could be a website screenshot, email signature, business card, letterhead, etc.).' },
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
        console.error(`[analyse-customer] Attempt ${attempt + 1} failed:`, err)
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    if (!extracted) {
      return NextResponse.json({ error: 'Failed to extract company data. The content may not contain company information.' }, { status: 400 })
    }

    const str = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = extracted![k]
        if (typeof v === 'string' && v.length > 0) return v
      }
      return null
    }

    const customerType = str(['customer_type'])
    const validTypes = ['education', 'business', 'charity']

    const customerData = {
      company_name: str(['company_name', 'name', 'organisation', 'organization']) || '',
      customer_type: validTypes.includes(customerType || '') ? customerType : 'business',
      address_line1: str(['address_line1', 'address_line_1', 'street']),
      address_line2: str(['address_line2', 'address_line_2', 'locality']),
      city: str(['city', 'town']),
      county: str(['county', 'region']),
      postcode: str(['postcode', 'postal_code', 'zip']),
      phone: str(['phone', 'telephone', 'phone_number']),
      email: str(['email', 'company_email']),
      website: str(['website', 'url', 'web']),
      vat_number: str(['vat_number', 'vat']),
      contact_first_name: str(['contact_first_name']),
      contact_last_name: str(['contact_last_name']),
      contact_job_title: str(['contact_job_title']),
      contact_email: str(['contact_email']),
      contact_phone: str(['contact_phone']),
      contact_mobile: str(['contact_mobile']),
      confidence: (['high', 'medium', 'low'].includes(extracted.confidence as string) ? extracted.confidence : 'medium') as 'high' | 'medium' | 'low',
    }

    return NextResponse.json({ extracted: customerData })
  } catch (err) {
    console.error('[analyse-customer]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
