// =============================================================================
// User Graph Client
// Sends email via Microsoft Graph using per-user delegated OAuth tokens.
// Unlike GraphClient (application-level client credentials), this uses
// refresh_token/access_token pairs stored per user so emails appear in
// the user's own Outlook Sent Items.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import type { MailConnection } from './types'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL_TEMPLATE = 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token'

interface UserCredential {
  id: string
  access_token: string | null
  refresh_token: string
  token_expires_at: string
  email_address: string
  display_name: string | null
}

export class UserGraphClient {
  private userId: string
  private orgId: string
  private cachedToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(userId: string, orgId: string) {
    this.userId = userId
    this.orgId = orgId
  }

  /**
   * Get a valid access token for this user, refreshing if needed.
   */
  async getToken(): Promise<string> {
    // Return cached if still valid (5 min buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 300_000) {
      return this.cachedToken
    }

    const supabase = createAdminClient()

    // Load the user's credential
    const { data: cred, error: credError } = await supabase
      .from('user_mail_credentials')
      .select('id, access_token, refresh_token, token_expires_at, email_address, display_name')
      .eq('user_id', this.userId)
      .eq('org_id', this.orgId)
      .eq('is_active', true)
      .single()

    if (credError || !cred) {
      throw new Error('No active mail credential found for this user')
    }

    const credential = cred as UserCredential

    // Check if stored token is still valid
    const expiresAt = new Date(credential.token_expires_at).getTime()
    if (credential.access_token && Date.now() < expiresAt - 300_000) {
      this.cachedToken = credential.access_token
      this.tokenExpiresAt = expiresAt
      return credential.access_token
    }

    // Token expired — refresh it
    const connection = await this.getMailConnection(supabase)
    const tokenUrl = TOKEN_URL_TEMPLATE.replace('{tenantId}', connection.tenant_id)

    const body = new URLSearchParams({
      client_id: connection.client_id,
      client_secret: connection.client_secret,
      refresh_token: credential.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Send offline_access',
    })

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      // Mark credential as inactive if refresh fails permanently
      if (res.status === 400 || res.status === 401) {
        await supabase
          .from('user_mail_credentials')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', credential.id)
      }
      throw new Error(`Token refresh failed (${res.status}): ${err}`)
    }

    const data = await res.json()
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    // Update stored tokens
    await supabase
      .from('user_mail_credentials')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || credential.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', credential.id)

    this.cachedToken = data.access_token
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000
    return data.access_token
  }

  /**
   * Send an email from this user's mailbox via delegated permissions.
   * saveToSentItems is always true — this is the entire reason for per-user auth.
   */
  async sendMail(message: {
    to: { address: string; name?: string }[]
    cc?: { address: string; name?: string }[]
    bcc?: { address: string; name?: string }[]
    subject: string
    bodyHtml: string
    attachments?: { name: string; contentType: string; contentBytes: string }[]
    customHeaders?: { name: string; value: string }[]
  }): Promise<{ graphMessageId?: string }> {
    const token = await this.getToken()

    const internetMessageHeaders: { name: string; value: string }[] = [
      ...(message.customHeaders || []),
    ]

    const payload: Record<string, unknown> = {
      message: {
        subject: message.subject,
        body: { contentType: 'HTML', content: message.bodyHtml },
        toRecipients: message.to.map(r => ({
          emailAddress: { address: r.address, name: r.name || r.address },
        })),
        ...(message.cc && message.cc.length > 0
          ? {
              ccRecipients: message.cc.map(r => ({
                emailAddress: { address: r.address, name: r.name || r.address },
              })),
            }
          : {}),
        ...(message.bcc && message.bcc.length > 0
          ? {
              bccRecipients: message.bcc.map(r => ({
                emailAddress: { address: r.address, name: r.name || r.address },
              })),
            }
          : {}),
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

    // Use /me/sendMail since we have delegated token
    const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to send mail (${res.status}): ${err}`)
    }

    // Graph sendMail returns 202 with no body — no message ID returned directly.
    // We can't get the message ID from the send response.
    return {}
  }

  /**
   * Get the user's email address from stored credentials.
   */
  async getEmailAddress(): Promise<{ email: string; displayName: string | null }> {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('user_mail_credentials')
      .select('email_address, display_name')
      .eq('user_id', this.userId)
      .eq('org_id', this.orgId)
      .eq('is_active', true)
      .single()

    if (!data) throw new Error('No active mail credential found')
    return { email: data.email_address, displayName: data.display_name }
  }

  private async getMailConnection(supabase: ReturnType<typeof createAdminClient>): Promise<MailConnection> {
    const { data, error } = await supabase
      .from('mail_connections')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error || !data) {
      throw new Error('No active mail connection found for this organisation')
    }
    return data as MailConnection
  }
}
