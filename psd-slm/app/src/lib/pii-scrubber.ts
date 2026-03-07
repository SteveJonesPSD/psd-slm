/**
 * lib/pii-scrubber.ts
 * Strips PII patterns from free text before tsvector search indexing.
 * Used ONLY for helpdesk ticket search token generation.
 * Does NOT alter stored content — input text is never modified in the DB.
 */

const PII_PATTERNS: RegExp[] = [
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // UK phone numbers (various formats)
  /(\+44\s?|0)(\d\s?){9,10}/g,
  // UK postcodes
  /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi,
  // IP addresses (v4)
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Password-like patterns ("password:", "pwd:", "pass:")
  /\b(password|passwd|pwd|pass)\s*[:=]\s*\S+/gi,
  // Card number patterns (16 digits, optional spaces/dashes)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
]

/**
 * Returns a sanitised copy of content safe for tsvector indexing.
 * PII patterns replaced with a space. Original content is unchanged.
 */
export function sanitiseForSearch(content: string): string {
  let sanitised = content
  for (const pattern of PII_PATTERNS) {
    sanitised = sanitised.replace(pattern, ' ')
  }
  // Collapse whitespace
  return sanitised.replace(/\s+/g, ' ').trim()
}
