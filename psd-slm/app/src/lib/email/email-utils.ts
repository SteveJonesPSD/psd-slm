// =============================================================================
// Email Utility Functions
// HTML sanitisation, signature stripping, quoted reply stripping, address parsing
// =============================================================================

// Allowed HTML tags for email body sanitisation
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'strong', 'em', 'u', 'a',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'div', 'span', 'hr', 'img',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
}

/**
 * Sanitise HTML email body — strip dangerous elements but preserve formatting.
 * This is a lightweight server-side sanitiser. For production use with untrusted
 * input, consider using sanitize-html or DOMPurify with jsdom.
 */
export function sanitiseHtml(html: string): string {
  if (!html) return ''

  let sanitised = html

  // Remove script tags and contents
  sanitised = sanitised.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Remove style tags and contents
  sanitised = sanitised.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove event handlers
  sanitised = sanitised.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitised = sanitised.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
  // Remove javascript: URLs
  sanitised = sanitised.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
  // Remove data: URLs in src (except images)
  sanitised = sanitised.replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, 'src=""')

  return sanitised
}

/**
 * Convert HTML to readable plain text.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''

  let text = html

  // Replace block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
  text = text.replace(/<(p|div|h[1-6]|blockquote)[^>]*>/gi, '\n')

  // List markers
  text = text.replace(/<li[^>]*>/gi, '\n• ')

  // Horizontal rules
  text = text.replace(/<hr[^>]*>/gi, '\n---\n')

  // Links: preserve href
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')

  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

/**
 * Strip email signature from plain text.
 * Conservative — better to include a signature than accidentally strip content.
 */
export function stripSignature(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  let signatureStart = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Standard signature delimiter (RFC 3676)
    if (line === '--' || line === '-- ') {
      signatureStart = i
      break
    }

    // Common mobile signatures
    if (/^Sent from my (iPhone|iPad|Galaxy|Android|Windows Phone)/i.test(line)) {
      signatureStart = i
      break
    }
    if (/^Get Outlook for (iOS|Android)/i.test(line)) {
      signatureStart = i
      break
    }
    if (/^Sent from Outlook/i.test(line)) {
      signatureStart = i
      break
    }
  }

  if (signatureStart > 0) {
    return lines.slice(0, signatureStart).join('\n').trimEnd()
  }

  return text
}

/**
 * Strip quoted reply text from plain text.
 * Removes "On ... wrote:" blocks and Outlook-style forwarding headers.
 * Conservative — only strips when patterns are confident.
 */
export function stripQuotedReply(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  let quoteStart = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // "On {date}, {name} wrote:" pattern
    if (/^On .+ wrote:\s*$/i.test(line)) {
      quoteStart = i
      break
    }

    // Outlook format: "From: ... Sent: ... To: ... Subject:"
    if (/^From:\s*.+/i.test(line) && i + 3 < lines.length) {
      const nextLines = lines.slice(i, i + 4).join('\n')
      if (/From:.*\nSent:.*\nTo:.*\nSubject:/i.test(nextLines)) {
        quoteStart = i
        break
      }
    }

    // Line of dashes or underscores (separator before quoted content)
    if (/^[-_]{5,}\s*$/.test(line) && i > 0) {
      // Check if next lines look like quoted content
      const nextLine = lines[i + 1]?.trim() || ''
      if (/^(From|De|Von|Da):/.test(nextLine) || /^>/.test(nextLine)) {
        quoteStart = i
        break
      }
    }
  }

  if (quoteStart > 0) {
    return lines.slice(0, quoteStart).join('\n').trimEnd()
  }

  // Strip lines starting with > (traditional quoting) if they appear at the end
  const reversed = [...lines].reverse()
  let lastNonQuoteLine = lines.length
  for (let i = 0; i < reversed.length; i++) {
    const line = reversed[i].trim()
    if (line === '' || line.startsWith('>')) {
      continue
    }
    lastNonQuoteLine = lines.length - i
    break
  }

  if (lastNonQuoteLine < lines.length) {
    return lines.slice(0, lastNonQuoteLine).join('\n').trimEnd()
  }

  return text
}

/**
 * Extract the "new" content from an email — strip quotes and signature.
 */
export function extractNewContent(text: string): string {
  let content = stripQuotedReply(text)
  content = stripSignature(content)
  return content.trim()
}

/**
 * Extract header value from Graph API internet message headers.
 */
export function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string | null {
  if (!headers) return null
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || null
}

/**
 * Parse References header into an array of Message-IDs.
 */
export function parseReferences(referencesHeader: string | null): string[] {
  if (!referencesHeader) return []
  // References header contains space-separated Message-IDs in angle brackets
  const matches = referencesHeader.match(/<[^>]+>/g)
  return matches || []
}

/**
 * Extract domain from an email address.
 */
export function extractDomain(email: string): string {
  const parts = email.split('@')
  return parts.length > 1 ? parts[1].toLowerCase() : ''
}
