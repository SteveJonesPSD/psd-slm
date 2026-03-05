// =============================================================================
// Email Integration Types
// =============================================================================

export interface MailConnection {
  id: string
  org_id: string
  name: string
  provider: 'microsoft_graph'
  tenant_id: string
  client_id: string
  client_secret: string
  is_active: boolean
  last_token_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MailChannel {
  id: string
  org_id: string
  connection_id: string
  mailbox_address: string
  handler: 'helpdesk' | 'purchasing' | 'sales'
  display_name: string | null
  is_active: boolean
  poll_interval_seconds: number
  last_poll_at: string | null
  last_message_at: string | null
  sync_cursor: string | null
  error_count: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MailChannelWithConnection extends MailChannel {
  mail_connections: MailConnection
}

export interface TicketEmail {
  id: string
  org_id: string
  ticket_id: string
  channel_id: string | null
  direction: 'inbound' | 'outbound'
  graph_message_id: string | null
  internet_message_id: string | null
  conversation_id: string | null
  in_reply_to: string | null
  from_address: string
  from_name: string | null
  to_addresses: EmailAddress[]
  cc_addresses: EmailAddress[]
  subject: string | null
  body_text: string | null
  body_html: string | null
  has_attachments: boolean
  attachments: EmailAttachmentMeta[]
  sent_at: string | null
  processed_at: string
  processing_notes: string | null
  created_at: string
}

export interface EmailAddress {
  address: string
  name?: string
}

export interface EmailAttachmentMeta {
  name: string
  size: number
  contentType: string
  storageKey: string
}

// Per-user delegated OAuth credentials for sending from personal mailboxes
export interface UserMailCredential {
  id: string
  org_id: string
  user_id: string
  email_address: string
  display_name: string | null
  access_token: string | null
  refresh_token: string
  token_expires_at: string
  granted_at: string
  granted_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuoteEmailSend {
  id: string
  org_id: string
  quote_id: string
  send_method: 'pdf' | 'portal' | 'both'
  sender_user_id: string
  sender_email: string
  recipient_addresses: string[]
  subject: string
  graph_message_id: string | null
  sent_at: string
  created_at: string
}

// Microsoft Graph API types

export interface GraphMessage {
  id: string
  internetMessageId: string
  conversationId: string
  subject: string
  bodyPreview: string
  body: { contentType: string; content: string }
  from: { emailAddress: { name: string; address: string } }
  toRecipients: { emailAddress: { name: string; address: string } }[]
  ccRecipients: { emailAddress: { name: string; address: string } }[]
  receivedDateTime: string
  hasAttachments: boolean
  isRead: boolean
  internetMessageHeaders?: { name: string; value: string }[]
}

export interface GraphAttachment {
  '@odata.type': string
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: string // base64
}

export interface ProcessedEmail {
  graphMessage: GraphMessage
  attachments: GraphAttachment[]
  inReplyTo: string | null
  references: string[]
}

export interface HandlerResult {
  action: 'created_ticket' | 'threaded_to_ticket' | 'skipped' | 'rejected' | 'error'
  ticketId?: string
  ticketNumber?: string
  notes: string
  sender?: string
  senderName?: string
}

export interface MessageDetail {
  messageId?: string
  sender?: string
  senderName?: string
  subject?: string
  action: 'created_ticket' | 'threaded_to_ticket' | 'skipped' | 'rejected' | 'error'
  reason: string
  ticketNumber?: string
}

export interface PollResult {
  channelId: string
  messagesFound: number
  messagesProcessed: number
  messagesSkipped: number
  messagesRejected: number
  errors: { messageId: string; error: string }[]
  rejections: { messageId: string; reason: string }[]
  messageDetails: MessageDetail[]
}

export interface MailProcessingLog {
  id: string
  org_id: string
  channel_id: string
  poll_started_at: string
  poll_ended_at: string | null
  messages_found: number
  messages_processed: number
  messages_skipped: number
  messages_rejected: number
  errors: { messageId: string; error: string }[]
  rejections: { messageId: string; reason: string }[]
  message_details: MessageDetail[] | null
  created_at: string
}

export const EMAIL_DIRECTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  inbound: { label: 'Inbound', color: '#2563eb', bg: '#eff6ff' },
  outbound: { label: 'Sent', color: '#059669', bg: '#ecfdf5' },
}

export const CHANNEL_STATUS = {
  active: { label: 'Active', color: '#059669', bg: '#ecfdf5' },
  warning: { label: 'Warning', color: '#d97706', bg: '#fffbeb' },
  error: { label: 'Error', color: '#dc2626', bg: '#fef2f2' },
  paused: { label: 'Paused', color: '#6b7280', bg: '#f3f4f6' },
} as const

export function getChannelStatus(channel: MailChannel): keyof typeof CHANNEL_STATUS {
  if (!channel.is_active) return 'paused'
  if (channel.error_count > 5) return 'error'
  if (channel.error_count > 0) return 'warning'
  return 'active'
}
