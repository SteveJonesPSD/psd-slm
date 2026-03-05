'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { UserGraphClient } from '@/lib/email/user-graph-client'
import type { UserMailCredential } from '@/lib/email/types'

// =============================================================================
// Types
// =============================================================================

export interface SendQuotePayload {
  sendMethod: 'pdf' | 'portal' | 'both'
  toAddresses: string[]
  subject: string
  messageBody: string
  senderUserId: string
}

export interface SendQuoteResult {
  success: boolean
  error?: string
}

// =============================================================================
// Get mail credential for a specific user
// =============================================================================

export async function getUserMailCredential(userId: string): Promise<UserMailCredential | null> {
  await requireAuth()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('user_mail_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  return (data as UserMailCredential) || null
}

// =============================================================================
// Get all users with active mail credentials in this org
// =============================================================================

export async function getOrgMailCredentials(): Promise<UserMailCredential[]> {
  const user = await requireAuth()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('user_mail_credentials')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('display_name')

  return (data || []) as UserMailCredential[]
}

// =============================================================================
// Disconnect a user's mail credential (admin only)
// =============================================================================

export async function disconnectMailCredential(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    return { success: false, error: 'Admin access required' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_mail_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', user.orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/team')
  return { success: true }
}

// =============================================================================
// Send quote email
// =============================================================================

export async function sendQuoteEmail(
  quoteId: string,
  payload: SendQuotePayload
): Promise<SendQuoteResult> {
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    return { success: false, error: 'Permission denied' }
  }

  const supabase = await createClient()

  // Load quote with related data
  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, status, portal_token, vat_rate, valid_until, customer_notes,
      customer_id, contact_id, assigned_to, brand_id,
      customers(name),
      contacts!quotes_contact_id_fkey(first_name, last_name, email),
      brands(name, phone, email, logo_path, footer_text),
      quote_lines(id, quantity, sell_price, is_optional, products(product_type))
    `)
    .eq('id', quoteId)
    .single()

  if (!quote) return { success: false, error: 'Quote not found' }

  // Load sender credential
  const adminSupabase = createAdminClient()
  const { data: senderCred } = await adminSupabase
    .from('user_mail_credentials')
    .select('*')
    .eq('user_id', payload.senderUserId)
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .single()

  if (!senderCred) {
    return { success: false, error: 'No active mail credential found for the selected sender' }
  }

  // Get sender user details for display name
  const { data: senderUser } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', payload.senderUserId)
    .single()

  const senderDisplayName = senderCred.display_name || (senderUser ? `${senderUser.first_name} ${senderUser.last_name}` : 'PSD Group')

  // Build email HTML
  const contact = quote.contacts as unknown as { first_name: string; last_name: string; email: string | null } | null
  const brand = quote.brands as unknown as { name: string; phone: string | null; email: string | null; logo_path: string | null; footer_text: string | null } | null
  const customer = quote.customers as unknown as { name: string } | null
  const contactFirstName = contact?.first_name || 'Customer'

  // Build portal URL
  let portalToken = quote.portal_token
  if (!portalToken) {
    portalToken = crypto.randomUUID()
    await supabase
      .from('quotes')
      .update({ portal_token: portalToken })
      .eq('id', quoteId)
  }
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/q/${portalToken}`

  // Calculate totals for the pre-fill template
  const lines = (quote.quote_lines || []) as unknown as { id: string; quantity: number; sell_price: number; is_optional: boolean; products: { product_type: string } | null }[]
  const nonOptionalLines = lines.filter(l => !l.is_optional)
  const subtotal = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)

  // Build the HTML body from the user's message
  const bodyHtml = buildQuoteEmailHtml({
    contactFirstName,
    messageBody: payload.messageBody,
    quoteNumber: quote.quote_number,
    validUntil: quote.valid_until,
    sendMethod: payload.sendMethod,
    portalUrl,
    senderDisplayName,
    brandName: brand?.name || 'PSD Group',
    brandPhone: brand?.phone || null,
    brandEmail: brand?.email || null,
  })

  // Build attachments if PDF send
  const attachments: { name: string; contentType: string; contentBytes: string }[] = []
  if (payload.sendMethod === 'pdf' || payload.sendMethod === 'both') {
    try {
      const pdfBase64 = await generateQuotePdfBase64(supabase, quoteId, quote.quote_number, portalUrl)
      if (pdfBase64) {
        attachments.push({
          name: `${quote.quote_number}.pdf`,
          contentType: 'application/pdf',
          contentBytes: pdfBase64,
        })
      } else {
        return { success: false, error: 'Failed to generate PDF attachment' }
      }
    } catch (pdfError) {
      console.error('[sendQuoteEmail] PDF generation failed:', pdfError)
      return { success: false, error: 'Failed to generate PDF attachment' }
    }
  }

  // Build custom headers for tracking
  const customHeaders = [
    { name: 'X-Engage-Quote-ID', value: quoteId },
    { name: 'X-Engage-Quote-Number', value: quote.quote_number },
  ]

  // Send via user's mailbox
  try {
    const client = new UserGraphClient(payload.senderUserId, user.orgId)
    await client.sendMail({
      to: payload.toAddresses.map(addr => {
        const trimmed = addr.trim()
        return { address: trimmed, name: trimmed }
      }),
      subject: payload.subject,
      bodyHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
      customHeaders,
    })
  } catch (sendError) {
    console.error('[sendQuoteEmail] Graph send failed:', sendError)
    return {
      success: false,
      error: sendError instanceof Error ? sendError.message : 'Failed to send email via Microsoft 365',
    }
  }

  // Record the send
  await adminSupabase.from('quote_email_sends').insert({
    org_id: user.orgId,
    quote_id: quoteId,
    send_method: payload.sendMethod,
    sender_user_id: payload.senderUserId,
    sender_email: senderCred.email_address,
    recipient_addresses: payload.toAddresses,
    subject: payload.subject,
    sent_at: new Date().toISOString(),
  })

  // Update quote status to 'sent' if draft or review
  if (['draft', 'review'].includes(quote.status)) {
    await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        portal_token: portalToken,
      })
      .eq('id', quoteId)
  }

  // Activity log
  logActivity({
    supabase,
    user,
    entityType: 'quote',
    entityId: quoteId,
    action: 'email_sent',
    details: {
      quote_number: quote.quote_number,
      send_method: payload.sendMethod,
      recipient_addresses: payload.toAddresses,
      sender_email: senderCred.email_address,
      sender_name: senderDisplayName,
    },
  })

  revalidatePath('/quotes')
  revalidatePath(`/quotes/${quoteId}`)

  return { success: true }
}

// =============================================================================
// PDF generation helper
// =============================================================================

async function generateQuotePdfBase64(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  quoteNumber: string,
  portalUrl: string
): Promise<string | null> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const React = await import('react')
  const { QuotePdfDocument } = await import('@/app/api/quotes/[id]/pdf/quote-pdf-document')

  const { data: fullQuote } = await supabase
    .from('quotes')
    .select(`
      *, customers(name, address_line1, address_line2, city, postcode),
      contacts!quotes_contact_id_fkey(first_name, last_name),
      brands(name, legal_entity, logo_path, logo_width, phone, fax, email, website, footer_text, default_terms, default_payment_terms_text, address_line1, address_line2, city, county, postcode, company_reg_number, vat_number),
      quote_groups(id, name, sort_order),
      quote_lines(id, group_id, sort_order, description, quantity, sell_price, is_optional, requires_contract, products(product_type))
    `)
    .eq('id', quoteId)
    .single()

  if (!fullQuote) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBrand = fullQuote.brands as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfCustomer = fullQuote.customers as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfContact = fullQuote.contacts as any
  const pdfGroups = (fullQuote.quote_groups || []) as unknown as { id: string; name: string; sort_order: number }[]
  const pdfLines = ((fullQuote.quote_lines || []) as unknown as { id: string; group_id: string | null; sort_order: number; description: string; quantity: number; sell_price: number; is_optional: boolean; requires_contract: boolean; products: { product_type: string } | null }[]).map(l => ({
    ...l,
    is_hidden_service: l.products?.product_type === 'service' && l.sell_price === 0,
  }))

  const element = React.createElement(QuotePdfDocument, {
    quote: {
      quote_number: fullQuote.quote_number,
      version: fullQuote.version,
      vat_rate: fullQuote.vat_rate,
      valid_until: fullQuote.valid_until,
      customer_notes: fullQuote.customer_notes,
      sent_at: fullQuote.sent_at,
      created_at: fullQuote.created_at,
    },
    customer: pdfCustomer,
    contact: pdfContact,
    brand: pdfBrand,
    groups: pdfGroups,
    lines: pdfLines,
    portalUrl,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any)
  return Buffer.from(buffer).toString('base64')
}

// =============================================================================
// HTML email template builder
// =============================================================================

function buildQuoteEmailHtml(params: {
  contactFirstName: string
  messageBody: string
  quoteNumber: string
  validUntil: string | null
  sendMethod: 'pdf' | 'portal' | 'both'
  portalUrl: string
  senderDisplayName: string
  brandName: string
  brandPhone: string | null
  brandEmail: string | null
}): string {
  const { contactFirstName, messageBody, quoteNumber, validUntil, sendMethod, portalUrl, senderDisplayName, brandName, brandPhone, brandEmail } = params

  // Convert plain text message to HTML paragraphs
  const messageHtml = messageBody
    .split('\n')
    .map(line => line.trim())
    .map(line => line ? `<p style="margin: 0 0 12px 0;">${escapeHtml(line)}</p>` : '<br>')
    .join('\n')

  const validUntilText = validUntil
    ? new Date(validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Portal link button (for portal or both modes)
  const portalButton = (sendMethod === 'portal' || sendMethod === 'both') ? `
    <div style="margin: 24px 0; text-align: center;">
      <a href="${portalUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
        View Quote ${quoteNumber} Online
      </a>
    </div>
    <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">
      The online portal allows you to view the full quotation, download a PDF copy, and accept the quote with your purchase order number.
    </p>
  ` : ''

  // Contact details
  const contactLines = [brandPhone, brandEmail].filter(Boolean)
  const contactBlock = contactLines.length > 0
    ? `<p style="margin: 0; font-size: 13px; color: #64748b;">${contactLines.join(' &middot; ')}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
<div style="max-width: 640px; margin: 0 auto; padding: 32px 24px;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <p style="margin: 0 0 12px 0;">Dear ${escapeHtml(contactFirstName)},</p>

    ${messageHtml}

    ${portalButton}

    ${validUntilText ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">This quotation is valid until ${validUntilText}.</p>` : ''}

    <p style="margin: 24px 0 0 0;">Kind regards,</p>
    <p style="margin: 4px 0 0 0; font-weight: 600;">${escapeHtml(senderDisplayName)}</p>
    <p style="margin: 2px 0 0 0; color: #64748b;">${escapeHtml(brandName)}</p>
    ${contactBlock}
  </div>
</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
