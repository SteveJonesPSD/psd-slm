/**
 * Email (.eml) parsing and domain extraction utilities for supplier quote emails
 */

import { simpleParser } from 'mailparser'

export interface ParsedEmail {
  bodyText: string
  senderEmail: string | null
  senderName: string | null
  subject: string | null
  date: string | null
}

/**
 * Parse a .eml file buffer and extract body text + sender metadata.
 */
export async function extractTextFromEml(buffer: Buffer): Promise<ParsedEmail> {
  const parsed = await simpleParser(buffer)

  // Prefer plain text body, fall back to stripped HTML
  let bodyText = parsed.text || ''
  if (!bodyText && parsed.html) {
    bodyText = parsed.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Extract sender info from the From header
  const from = parsed.from?.value?.[0]
  const senderEmail = from?.address || null
  const senderName = from?.name || null

  // Format date if present
  const date = parsed.date ? parsed.date.toISOString().split('T')[0] : null

  return {
    bodyText,
    senderEmail,
    senderName,
    subject: parsed.subject || null,
    date,
  }
}

/**
 * Extract the domain from an email address or website URL.
 * Strips www. prefix for consistent comparison.
 *
 * Examples:
 *   "john@westcoast.co.uk" → "westcoast.co.uk"
 *   "https://www.westcoast.co.uk/products" → "westcoast.co.uk"
 *   "westcoast.co.uk" → "westcoast.co.uk"
 */
export function extractDomain(emailOrUrl: string): string | null {
  if (!emailOrUrl) return null

  const trimmed = emailOrUrl.trim().toLowerCase()

  // Email address — extract domain after @
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@')
    const domain = parts[parts.length - 1]
    return domain.replace(/^www\./, '') || null
  }

  // URL — extract hostname
  try {
    const withProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    return url.hostname.replace(/^www\./, '') || null
  } catch {
    // Might be a bare domain
    return trimmed.replace(/^www\./, '').split('/')[0] || null
  }
}
