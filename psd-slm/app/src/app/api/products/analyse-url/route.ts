import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'

const ALLOWED_ROLES = ['super_admin', 'admin', 'sales']

const EXTRACTION_PROMPT = `You are extracting product information from a supplier or distributor product page. Extract the following structured data from the text provided.

You MUST return a JSON object with EXACTLY these field names:
{
  "product_name": "Full product name/title",
  "sku": "Manufacturer part number, model number, or SKU if shown",
  "description": "Brief product description (1-3 sentences max)",
  "manufacturer": "Manufacturer or brand name",
  "supplier_name": "The supplier/distributor website this was taken from",
  "supplier_sku": "The supplier's own part number or stock code (if different from manufacturer SKU)",
  "category_hint": "Product category (e.g. Networking, Cabling & Infrastructure, Environmental Sensors, Access Control, Software & Licensing, Audio Visual, Security, Servers & Storage)",
  "buy_price": null,
  "sell_price": null,
  "price": 0.00,
  "price_is_ex_vat": true,
  "is_stocked": false,
  "is_serialised": true,
  "product_type": "goods",
  "confidence": "high|medium|low"
}

Rules:
- Use null for any field you cannot find in the document
- Use EXACTLY the field names shown above
- For price, extract the main listed price (usually ex-VAT for trade/distributor sites). Set price_is_ex_vat to false if the price clearly includes VAT
- buy_price and sell_price should usually be null — we rarely find both on a single product page. Put the found price in the "price" field
- product_type should be "goods" for physical items, "service" for labour/support/licensing
- is_serialised should be true for hardware with serial numbers (switches, access points, servers, sensors), false for consumables/cables/software
- is_stocked should be false (we cannot determine this from a product page)
- confidence should be "high" if the page is clearly a product page with most fields readable, "medium" if some fields are ambiguous, "low" if the page doesn't appear to be a product page
- Return ONLY valid JSON, no markdown fencing or commentary`

/**
 * SSRF prevention: block requests to private/internal IP ranges.
 */
function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Block non-http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return true

    // Block localhost and common internal hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true
    if (hostname === '0.0.0.0' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return true

    // Block private IP ranges
    const parts = hostname.split('.')
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number)
      if (a === 10) return true // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
      if (a === 192 && b === 168) return true // 192.168.0.0/16
      if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
    }

    return false
  } catch {
    return true
  }
}

/**
 * Detect if HTML is a bot challenge page (AWS WAF, Cloudflare, etc.)
 */
function isBotChallenge(html: string, status: number): boolean {
  // AWS WAF challenge
  if (html.includes('awsWafCookieDomainList') || html.includes('x-amzn-waf-action')) return true
  if (html.includes('challenge.js') && html.includes('AwsWafIntegration')) return true
  // Cloudflare challenge
  if (html.includes('cf-challenge-running') || html.includes('_cf_chl_opt')) return true
  // Generic: 202 with tiny body is likely a challenge
  if (status === 202 && html.length < 3000) return true
  // Page that says JS is required with no real content
  if (html.includes('JavaScript is disabled') && html.length < 5000) return true
  return false
}

/**
 * Fetch page HTML and extract meaningful text content using cheerio.
 */
async function fetchAndParse(url: string): Promise<{ text: string; title: string; ogTitle: string | null; ogPrice: string | null; metaDescription: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    })

    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('Response is not HTML')
    }

    const html = await res.text()

    // Detect bot challenge pages
    if (!html || isBotChallenge(html, res.status)) {
      throw new Error('BOT_PROTECTED')
    }

    const $ = cheerio.load(html)

    // Extract metadata
    const title = $('title').first().text().trim()
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null
    const ogPrice = $('meta[property="og:price:amount"], meta[property="product:price:amount"]').attr('content')?.trim() || null
    const metaDescription = $('meta[name="description"], meta[property="og:description"]').first().attr('content')?.trim() || null

    // Remove noise elements
    $('script, style, nav, footer, header, aside, noscript, iframe, svg, [role="navigation"], [role="banner"], [role="contentinfo"]').remove()

    // Try to find main content area
    let contentEl = $('main, article, [role="main"], .product-detail, .product-info, #product, .pdp')
    if (contentEl.length === 0) {
      contentEl = $('body')
    }

    // Get text, collapse whitespace
    let text = contentEl.text()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Truncate to ~16000 chars to stay within Claude's sweet spot
    if (text.length > 16000) {
      text = text.substring(0, 16000) + '...[truncated]'
    }

    return { text, title, ogTitle, ogPrice, metaDescription }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Parse user-pasted text content (no HTML cleaning needed, just truncate).
 */
function parsePastedText(text: string): { text: string; title: string; ogTitle: string | null; ogPrice: string | null; metaDescription: string | null } {
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
  if (cleaned.length > 16000) {
    cleaned = cleaned.substring(0, 16000) + '...[truncated]'
  }
  return { text: cleaned, title: '', ogTitle: null, ogPrice: null, metaDescription: null }
}

/**
 * POST /api/products/analyse-url
 * Fetches a product page URL, extracts data with Claude, matches supplier/category.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!ALLOWED_ROLES.includes(user.role.name)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const url = (body.url as string)?.trim() || null
    const pastedText = (body.text as string)?.trim() || null
    const imageBase64 = (body.image as string)?.trim() || null
    const imageType = (body.image_type as string)?.trim() || null
    const sourceUrl = url || (body.source_url as string)?.trim() || ''

    // Must provide at least one input
    if (!url && !pastedText && !imageBase64) {
      return NextResponse.json({ error: 'URL, pasted text, or image is required' }, { status: 400 })
    }

    // Validate image input
    if (imageBase64) {
      const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      if (!imageType || !allowedImageTypes.includes(imageType)) {
        return NextResponse.json({ error: 'Invalid image type. Use PNG, JPEG, WebP, or GIF.' }, { status: 400 })
      }
      // Check approximate decoded size (base64 is ~4/3 of original)
      const approxBytes = imageBase64.length * 3 / 4
      if (approxBytes > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
      }
    }

    if (url) {
      // Validate URL format
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
      }

      // SSRF prevention
      if (isBlockedUrl(url)) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
      }
    }

    const supabase = await createClient()

    // Get API key — try org_settings first, fall back to env var
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

    // Get page data — either fetch from URL, use pasted text, or skip for image mode
    let pageData: { text: string; title: string; ogTitle: string | null; ogPrice: string | null; metaDescription: string | null } | null = null

    if (!imageBase64) {
      if (pastedText) {
        // User pasted content directly
        pageData = parsePastedText(pastedText)
      } else {
        // Fetch and parse the URL
        try {
          pageData = await fetchAndParse(url!)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch URL'
          if (msg === 'BOT_PROTECTED') {
            return NextResponse.json({
              error: 'This site has bot protection and blocked our request. Use "Paste page content" instead — copy the product page text from your browser and paste it below.',
              code: 'BOT_PROTECTED',
            }, { status: 400 })
          }
          return NextResponse.json({ error: `Could not fetch page: ${msg}` }, { status: 400 })
        }

        if (!pageData.text || pageData.text.length < 50) {
          return NextResponse.json({
            error: 'Page content too short or empty. The site may require JavaScript to render. Use "Paste page content" instead — copy the product page text from your browser and paste it below.',
            code: 'BOT_PROTECTED',
          }, { status: 400 })
        }
      }
    }

    // Build context for Claude including metadata
    const metadataBlock = pageData ? [
      pageData.title ? `Page title: ${pageData.title}` : null,
      pageData.ogTitle ? `OG title: ${pageData.ogTitle}` : null,
      pageData.ogPrice ? `OG price: ${pageData.ogPrice}` : null,
      pageData.metaDescription ? `Meta description: ${pageData.metaDescription}` : null,
      sourceUrl ? `Source URL: ${sourceUrl}` : null,
    ].filter(Boolean).join('\n') : ''

    // Call Claude with retry
    const client = new Anthropic({ apiKey })
    let extracted: Record<string, unknown> | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Build message content — image mode uses multimodal, text mode uses string
        const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = imageBase64
          ? [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: imageType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: imageBase64 } },
              { type: 'text' as const, text: EXTRACTION_PROMPT + '\n\nExtract product information from this screenshot of a product page.' },
            ]
          : `${EXTRACTION_PROMPT}\n\n--- PAGE METADATA ---\n${metadataBlock}\n\n--- PAGE CONTENT ---\n${pageData!.text}`

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: messageContent,
            },
          ],
        })

        const textBlock = response.content.find((block) => block.type === 'text')
        if (!textBlock?.text) throw new Error('No text in response')

        // Strip markdown fencing
        let jsonStr = textBlock.text.trim()
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        extracted = JSON.parse(jsonStr) as Record<string, unknown>
        break
      } catch (err) {
        console.error(`[analyse-url] Attempt ${attempt + 1} failed:`, err)
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    if (!extracted) {
      return NextResponse.json({ error: 'Failed to extract product data from page. The page may not contain product information.' }, { status: 400 })
    }

    // Normalize extracted fields
    const str = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = extracted![k]
        if (typeof v === 'string' && v.length > 0) return v
      }
      return null
    }

    const num = (keys: string[]): number | null => {
      for (const k of keys) {
        const v = extracted![k]
        if (typeof v === 'number' && v > 0) return v
        if (typeof v === 'string') {
          const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
          if (!isNaN(n) && n > 0) return n
        }
      }
      return null
    }

    const bool = (key: string, fallback: boolean): boolean => {
      const v = extracted![key]
      if (typeof v === 'boolean') return v
      return fallback
    }

    const productData = {
      name: str(['product_name', 'name', 'title']) || pageData?.ogTitle || pageData?.title || '',
      sku: str(['sku', 'part_number', 'model_number', 'mpn']),
      description: str(['description', 'short_description', 'summary']),
      manufacturer: str(['manufacturer', 'brand', 'vendor']),
      supplier_name: str(['supplier_name', 'supplier', 'distributor']),
      supplier_sku: str(['supplier_sku', 'supplier_part_number', 'stock_code']),
      category_hint: str(['category_hint', 'category', 'product_category']),
      price: num(['price', 'buy_price', 'cost', 'unit_price']),
      price_is_ex_vat: bool('price_is_ex_vat', true),
      is_stocked: bool('is_stocked', false),
      is_serialised: bool('is_serialised', true),
      product_type: str(['product_type']) === 'service' ? 'service' as const : 'goods' as const,
      confidence: (['high', 'medium', 'low'].includes(extracted.confidence as string) ? extracted.confidence : 'medium') as 'high' | 'medium' | 'low',
    }

    // Match supplier by name (case-insensitive)
    let matched_supplier_id: string | null = null
    if (productData.supplier_name) {
      // Try exact match first
      const { data: exactMatch } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('org_id', user.orgId)
        .eq('is_active', true)
        .ilike('name', productData.supplier_name)
        .limit(1)
        .maybeSingle()

      if (exactMatch) {
        matched_supplier_id = exactMatch.id
      } else {
        // Try substring match
        const { data: partialMatch } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('org_id', user.orgId)
          .eq('is_active', true)
          .ilike('name', `%${productData.supplier_name}%`)
          .limit(1)
          .maybeSingle()

        if (partialMatch) {
          matched_supplier_id = partialMatch.id
        }
      }
    }

    // Match category
    let matched_category_id: string | null = null
    if (productData.category_hint) {
      const { data: catMatch } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('org_id', user.orgId)
        .ilike('name', `%${productData.category_hint}%`)
        .limit(1)
        .maybeSingle()

      if (catMatch) {
        matched_category_id = catMatch.id
      }
    }

    // Fetch reference data for the form dropdowns
    const [categoriesRes, suppliersRes, manufacturersRes] = await Promise.all([
      supabase
        .from('product_categories')
        .select('id, name')
        .eq('org_id', user.orgId)
        .order('sort_order'),
      supabase
        .from('suppliers')
        .select('id, name, account_number')
        .eq('org_id', user.orgId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('products')
        .select('manufacturer')
        .eq('org_id', user.orgId)
        .not('manufacturer', 'is', null),
    ])

    const manufacturers = [...new Set((manufacturersRes.data || []).map((p) => p.manufacturer).filter(Boolean))] as string[]

    return NextResponse.json({
      extracted: productData,
      matched_supplier_id,
      matched_category_id,
      categories: categoriesRes.data || [],
      suppliers: suppliersRes.data || [],
      manufacturers,
      source_url: sourceUrl,
    })
  } catch (err) {
    console.error('[analyse-url]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
