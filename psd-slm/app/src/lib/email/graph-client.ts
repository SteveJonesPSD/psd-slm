// =============================================================================
// Microsoft Graph API Client
// Handles OAuth token management and all Graph API interactions.
// =============================================================================

import type { MailConnection, GraphMessage, GraphAttachment } from './types'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL_TEMPLATE = 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token'

interface TokenCache {
  token: string
  expiresAt: number
}

export class GraphClient {
  private connection: MailConnection
  private tokenCache: TokenCache | null = null

  constructor(connection: MailConnection) {
    this.connection = connection
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  async getToken(forceRefresh = false): Promise<string> {
    // Return cached token if still valid (with 5min buffer) — unless forced
    if (!forceRefresh && this.tokenCache && Date.now() < this.tokenCache.expiresAt - 300_000) {
      console.log('[GraphClient] Using cached token (expires in', Math.round((this.tokenCache.expiresAt - Date.now()) / 1000), 'seconds)')
      return this.tokenCache.token
    }

    console.log('[GraphClient] Fetching new token from Azure AD', forceRefresh ? '(forced refresh)' : this.tokenCache ? '(cache expired)' : '(no cache)')

    const url = TOKEN_URL_TEMPLATE.replace('{tenantId}', this.connection.tenant_id)
    const body = new URLSearchParams({
      client_id: this.connection.client_id,
      client_secret: this.connection.client_secret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Token acquisition failed (${res.status}): ${err}`)
    }

    const data = await res.json()
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    }

    console.log('[GraphClient] New token acquired, expires in', data.expires_in, 'seconds')
    return this.tokenCache.token
  }

  clearTokenCache(): void {
    this.tokenCache = null
    console.log('[GraphClient] Token cache cleared')
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async graphFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken()
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // Retry on 403 (Forbidden) — token may be stale after policy changes
    if (res.status === 403) {
      console.log('[GraphClient] Got 403, clearing token cache and retrying with fresh token')
      this.clearTokenCache()
      const freshToken = await this.getToken(true)
      return fetch(`${GRAPH_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
    }

    // Retry once on 429 (rate limited) or 503 (service unavailable)
    if (res.status === 429 || res.status === 503) {
      await new Promise(r => setTimeout(r, 2000))
      const retryToken = await this.getToken()
      return fetch(`${GRAPH_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${retryToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
    }

    return res
  }

  // ---------------------------------------------------------------------------
  // List messages from a mailbox
  // ---------------------------------------------------------------------------

  async listMessages(mailbox: string, since: string | null, top: number = 50): Promise<GraphMessage[]> {
    let filter = ''
    if (since) {
      // Ensure ISO 8601 with Z suffix — Supabase TIMESTAMPTZ may omit it
      const sinceIso = new Date(since).toISOString()
      filter = `&$filter=receivedDateTime gt ${sinceIso}`
    } else {
      // First run safety: only fetch last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      filter = `&$filter=receivedDateTime gt ${yesterday}`
    }

    const select = [
      'id', 'internetMessageId', 'conversationId', 'subject', 'bodyPreview',
      'body', 'from', 'toRecipients', 'ccRecipients', 'receivedDateTime',
      'hasAttachments', 'isRead', 'internetMessageHeaders',
    ].join(',')

    const path = `/users/${encodeURIComponent(mailbox)}/messages?$select=${select}&$orderby=receivedDateTime asc&$top=${top}${filter}`

    const res = await this.graphFetch(path)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to list messages (${res.status}): ${err}`)
    }

    const data = await res.json()
    return (data.value || []) as GraphMessage[]
  }

  // ---------------------------------------------------------------------------
  // Get message headers (In-Reply-To, References)
  // ---------------------------------------------------------------------------

  async getMessageHeaders(mailbox: string, messageId: string): Promise<{ name: string; value: string }[]> {
    const path = `/users/${encodeURIComponent(mailbox)}/messages/${messageId}?$select=internetMessageHeaders`
    const res = await this.graphFetch(path)

    if (!res.ok) {
      return []
    }

    const data = await res.json()
    return data.internetMessageHeaders || []
  }

  // ---------------------------------------------------------------------------
  // Get attachments for a message
  // ---------------------------------------------------------------------------

  async getAttachments(mailbox: string, messageId: string): Promise<GraphAttachment[]> {
    const path = `/users/${encodeURIComponent(mailbox)}/messages/${messageId}/attachments`
    const res = await this.graphFetch(path)

    if (!res.ok) {
      return []
    }

    const data = await res.json()
    // Only return file attachments (skip inline/embedded images)
    return ((data.value || []) as GraphAttachment[]).filter(
      a => a['@odata.type'] === '#microsoft.graph.fileAttachment'
    )
  }

  // ---------------------------------------------------------------------------
  // Send mail from a mailbox
  // ---------------------------------------------------------------------------

  async sendMail(mailbox: string, message: {
    to: { address: string; name?: string }[]
    cc?: { address: string; name?: string }[]
    subject: string
    bodyHtml: string
    inReplyTo?: string
    references?: string[]
    attachments?: { name: string; contentType: string; contentBytes: string }[]
  }): Promise<void> {
    const internetMessageHeaders: { name: string; value: string }[] = []
    // Graph API only allows custom headers prefixed with 'x-' or 'X-'.
    // Standard RFC headers (In-Reply-To, References) are rejected.
    // Threading still works via conversationId and subject-line ticket refs.
    if (message.inReplyTo) {
      internetMessageHeaders.push({ name: 'X-In-Reply-To', value: message.inReplyTo })
    }
    if (message.references && message.references.length > 0) {
      internetMessageHeaders.push({ name: 'X-References', value: message.references.join(' ') })
    }

    const payload: Record<string, unknown> = {
      message: {
        subject: message.subject,
        body: { contentType: 'HTML', content: message.bodyHtml },
        toRecipients: message.to.map(r => ({ emailAddress: { address: r.address, name: r.name || r.address } })),
        ccRecipients: (message.cc || []).map(r => ({ emailAddress: { address: r.address, name: r.name || r.address } })),
        ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
        ...(message.attachments && message.attachments.length > 0
          ? {
              attachments: message.attachments.map(a => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: a.name,
                contentType: a.contentType,
                contentBytes: a.contentBytes,
              })),
            }
          : {}),
      },
      saveToSentItems: true,
    }

    const path = `/users/${encodeURIComponent(mailbox)}/sendMail`
    const res = await this.graphFetch(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to send mail (${res.status}): ${err}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Mark a message as read
  // ---------------------------------------------------------------------------

  async markAsRead(mailbox: string, messageId: string): Promise<void> {
    const path = `/users/${encodeURIComponent(mailbox)}/messages/${messageId}`
    await this.graphFetch(path, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    })
  }

  // ---------------------------------------------------------------------------
  // Test connection (verify credentials and mailbox access)
  // ---------------------------------------------------------------------------

  async testConnection(mailbox: string): Promise<{ success: boolean; displayName?: string; error?: string }> {
    try {
      await this.getToken()

      // Try to list 1 message to verify mailbox access
      const path = `/users/${encodeURIComponent(mailbox)}/messages?$top=1&$select=id`
      const res = await this.graphFetch(path)

      if (!res.ok) {
        const err = await res.text()
        return { success: false, error: `Mailbox access failed (${res.status}): ${err}` }
      }

      // Get mailbox display name
      const userPath = `/users/${encodeURIComponent(mailbox)}?$select=displayName`
      const userRes = await this.graphFetch(userPath)
      let displayName = mailbox
      if (userRes.ok) {
        const userData = await userRes.json()
        displayName = userData.displayName || mailbox
      }

      return { success: true, displayName }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}
