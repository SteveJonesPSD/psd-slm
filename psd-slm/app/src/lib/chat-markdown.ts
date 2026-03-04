/**
 * Shared lightweight Markdown renderer for AI chat responses.
 * Supports bold, italic, code, lists, tables, markdown links,
 * auto-links Engage reference numbers (tickets, quotes, etc.),
 * and auto-links bare internal paths (/quotes/{uuid}, etc.).
 *
 * Internal links are marked with data-internal="true" so the consuming
 * component can intercept clicks for client-side navigation.
 */

/** UUID pattern fragment (used in bare path detection) */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Reference patterns → route mappings for auto-linking (with search param fallback) */
const REFERENCE_PATTERNS: { regex: RegExp; route: string }[] = [
  // Ticket: TKT-2026-0001
  { regex: /\b(TKT-\d{4}-\d{4})\b/g, route: '/helpdesk' },
  // Quote: Q-2026-0001, ES-2026-0001, SC-2026-0001
  { regex: /\b((?:Q|ES|SC)-\d{4}-\d{4})\b/g, route: '/quotes' },
  // Sales Order: SO-2026-0001
  { regex: /\b(SO-\d{4}-\d{4})\b/g, route: '/orders' },
  // Purchase Order: PO-2026-0001
  { regex: /\b(PO-\d{4}-\d{4})\b/g, route: '/purchase-orders' },
  // Invoice: INV-2026-0001 (and credit note variants)
  { regex: /\b(INV-\d{4}-\d{4}(?:-CN\d+)?)\b/g, route: '/invoices' },
  // Delivery Note: DN-2026-0001
  { regex: /\b(DN-\d{4}-\d{4})\b/g, route: '/delivery-notes' },
  // Job: JOB-2026-0001
  { regex: /\b(JOB-\d{4}-\d{4})\b/g, route: '/scheduling/jobs' },
]

/**
 * Bare internal path patterns — these are full detail-page URLs that the AI
 * generates from tool results (e.g. /quotes/{uuid}). We linkify them as-is
 * since they already point to the correct detail page.
 */
const BARE_PATH_REGEX = new RegExp(
  `(?:^|[\\s(])(\\/(?:quotes|orders|purchase-orders|invoices|delivery-notes|customers|helpdesk\\/tickets|scheduling\\/jobs|products|suppliers|deal-registrations|opportunities|agents\\/\\w+)\\/${UUID})(?=[\\s).,;:!?]|$)`,
  'gi'
)

/** https:// and http:// bare URLs */
const BARE_URL_REGEX = /(?:^|[\s(])(https?:\/\/[^\s)<]+)/gi

function makeInternalLink(href: string, text: string): string {
  return `<a href="${href}" data-internal="true" class="underline font-medium text-indigo-600 hover:text-indigo-800">${text}</a>`
}

function makeExternalLink(href: string, text: string): string {
  return `<a href="${href}" class="underline text-indigo-600 hover:text-indigo-800" target="_blank" rel="noopener noreferrer">${text}</a>`
}

/**
 * Auto-link Engage reference numbers, bare internal paths,
 * bare external URLs, and markdown links.
 */
function autoLinkReferences(html: string): string {
  // Markdown links: [text](url) — convert to <a> tags first
  // Internal paths (starting with /) get data-internal for client-side nav
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text: string, url: string) => {
      if (url.startsWith('/')) {
        return makeInternalLink(url, text)
      }
      return makeExternalLink(url, text)
    }
  )

  // Auto-link bare internal paths like /quotes/{uuid} (before reference patterns,
  // so the full UUID link takes precedence when both appear)
  html = html.replace(BARE_PATH_REGEX, (match, path: string) => {
    const prefix = match.startsWith('/') ? '' : match[0]
    // Show a friendly shortened version of the path
    const segments = path.split('/')
    const lastSegment = segments[segments.length - 1]
    // If it's a UUID, show "View details" as link text; otherwise show the path
    const isUuid = /^[0-9a-f]{8}-/.test(lastSegment)
    const label = isUuid ? 'View details' : path
    return prefix + makeInternalLink(path, label)
  })

  // Auto-link bare https:// URLs (that aren't already inside an <a> tag)
  html = html.replace(BARE_URL_REGEX, (match, url: string) => {
    // Don't re-link if already inside an href
    const prefix = match.startsWith('h') ? '' : match[0]
    // Truncate display if very long
    const display = url.length > 60 ? url.slice(0, 57) + '...' : url
    return prefix + makeExternalLink(url, display)
  })

  // Auto-link reference numbers with data-internal for client-side nav
  // Uses search param so the list page filters to the specific record
  // Skip matches already inside an <a> tag to avoid double-linking
  for (const { regex, route } of REFERENCE_PATTERNS) {
    html = html.replace(regex, (match, ref: string, offset: number) => {
      // Check if this match is inside an existing <a> tag
      const before = html.slice(0, offset)
      const lastOpenA = before.lastIndexOf('<a ')
      const lastCloseA = before.lastIndexOf('</a>')
      if (lastOpenA > lastCloseA) {
        // We're inside an <a> tag — don't double-link
        return match
      }
      return makeInternalLink(`${route}?search=${encodeURIComponent(ref)}`, ref)
    })
  }

  return html
}

/**
 * Create a click handler for a container with rendered markdown.
 * Intercepts clicks on data-internal links for client-side navigation.
 */
export function createMarkdownClickHandler(
  router: { push: (url: string) => void }
): (e: React.MouseEvent) => void {
  return (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const anchor = target.closest('a[data-internal]') as HTMLAnchorElement | null
    if (anchor) {
      e.preventDefault()
      router.push(anchor.getAttribute('href') || '/')
    }
  }
}

/**
 * Render a markdown string to HTML for chat message display.
 */
export function renderMarkdown(text: string): string {
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Unescape safe inline colour spans the AI outputs for margin formatting
  // e.g. <span style="color:green">42.6%</span> → actual styled span
  html = html.replace(
    /&lt;span style=&quot;color:\s*([\w#]+)&quot;&gt;(.*?)&lt;\/span&gt;/gi,
    '<span style="color:$1">$2</span>'
  )

  // Tables: detect lines with | separators
  html = html.replace(
    /(?:^|\n)((?:\|.+\|(?:\n|$))+)/g,
    (_, tableBlock: string) => {
      const rows = tableBlock.trim().split('\n')
      if (rows.length < 2) return tableBlock

      const isSeparator = /^\|[\s\-:|]+\|$/.test(rows[1])
      const dataRows = isSeparator ? [rows[0], ...rows.slice(2)] : rows

      const renderRow = (row: string, isHeader: boolean) => {
        const cells = row.split('|').slice(1, -1).map((c) => c.trim())
        const tag = isHeader ? 'th' : 'td'
        const cls = isHeader
          ? 'px-2 py-1 text-left text-xs font-semibold text-slate-600 border-b border-slate-200'
          : 'px-2 py-1 text-xs text-slate-700 border-b border-slate-100'
        return `<tr>${cells.map((c) => `<${tag} class="${cls}">${c}</${tag}>`).join('')}</tr>`
      }

      let tableHtml = '<div class="overflow-x-auto -mx-1"><table class="w-full text-left my-1 border-collapse text-[11px]">'
      if (isSeparator) {
        tableHtml += `<thead>${renderRow(dataRows[0], true)}</thead>`
        tableHtml += '<tbody>'
        for (let i = 1; i < dataRows.length; i++) {
          tableHtml += renderRow(dataRows[i], false)
        }
        tableHtml += '</tbody>'
      } else {
        tableHtml += '<tbody>'
        for (const row of dataRows) {
          tableHtml += renderRow(row, false)
        }
        tableHtml += '</tbody>'
      }
      tableHtml += '</table></div>'
      return '\n' + tableHtml
    }
  )

  // Code blocks (```)
  html = html.replace(
    /```(?:\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-slate-800 text-slate-100 text-xs rounded p-2 my-1 overflow-x-auto whitespace-pre-wrap">$1</pre>'
  )

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-slate-200 text-slate-800 text-xs rounded px-1">$1</code>'
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Headings (### → h4, ## → h3 — appropriate for chat context)
  html = html.replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-2 mb-1">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')

  // Bullet lists
  html = html.replace(
    /(?:^|\n)((?:[-*] .+(?:\n|$))+)/g,
    (_, block: string) => {
      const items = block
        .trim()
        .split('\n')
        .map((l: string) => `<li>${l.replace(/^[-*] /, '')}</li>`)
        .join('')
      return `\n<ul class="my-1 space-y-0.5 list-disc list-inside pl-1">${items}</ul>`
    }
  )

  // Numbered lists
  html = html.replace(
    /(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g,
    (_, block: string) => {
      const items = block
        .trim()
        .split('\n')
        .map((l: string) => `<li>${l.replace(/^\d+\. /, '')}</li>`)
        .join('')
      return `\n<ol class="my-1 space-y-0.5 list-decimal list-inside pl-1">${items}</ol>`
    }
  )

  // Auto-link references, bare paths, bare URLs, and markdown links
  html = autoLinkReferences(html)

  // Paragraphs (double newlines)
  html = html
    .split(/\n{2,}/)
    .map((p) => {
      const trimmed = p.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return trimmed
      return `<p class="my-1">${trimmed}</p>`
    })
    .join('')

  // Single newlines within paragraphs to <br>
  html = html.replace(/([^>])\n([^<])/g, '$1<br/>$2')

  return html
}
