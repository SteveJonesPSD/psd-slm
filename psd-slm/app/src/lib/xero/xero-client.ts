/**
 * XeroClient — isolates ALL xero-node imports.
 * Never import xero-node anywhere else in the codebase.
 *
 * Uses Xero Custom Connections (client credentials / machine-to-machine).
 * No user OAuth flow required.
 */

import { XeroClient as XeroNodeClient } from 'xero-node'
import { createAdminClient } from '@/lib/supabase/admin'

interface XeroCredentials {
  client_id: string
  client_secret: string
  tenant_id: string
}

export interface XeroPushResult {
  success: boolean
  xero_invoice_id?: string
  error?: string
}

// Module-level token cache (per server instance)
let cachedToken: string | null = null
let tokenExpiresAt: number = 0
const TOKEN_BUFFER_MS = 5 * 60 * 1000 // 5 minute buffer

export class EngageXeroClient {
  private credentials: XeroCredentials
  private xero: XeroNodeClient

  constructor(credentials: XeroCredentials) {
    this.credentials = credentials
    this.xero = new XeroNodeClient({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      grantType: 'client_credentials',
      scopes: ['accounting.transactions', 'accounting.contacts'],
    })
  }

  private async getToken(): Promise<string> {
    const now = Date.now()
    if (cachedToken && now < tokenExpiresAt - TOKEN_BUFFER_MS) {
      return cachedToken
    }
    const tokenSet = await this.xero.getClientCredentialsToken()
    cachedToken = tokenSet.access_token!
    tokenExpiresAt = now + (tokenSet.expires_in! * 1000)
    return cachedToken
  }

  async testConnection(): Promise<{ success: boolean; org_name?: string; error?: string }> {
    try {
      await this.getToken()
      const result = await this.xero.accountingApi.getOrganisations(this.credentials.tenant_id)
      const orgName = result.body.organisations?.[0]?.name ?? undefined
      return { success: true, org_name: orgName }
    } catch (err: unknown) {
      cachedToken = null
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { success: false, error: message }
    }
  }

  /**
   * Resolve the Xero Contact UUID for a customer.
   * Reads the xero_reference column from the customers table.
   */
  async resolveXeroContact(customerId: string): Promise<string> {
    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, xero_reference')
      .eq('id', customerId)
      .single()

    if (!customer) throw new Error(`Customer ${customerId} not found`)

    const xeroContactId = customer.xero_reference?.trim()

    if (!xeroContactId) {
      throw new Error(
        `Customer "${customer.name}" does not have a Xero Reference set. ` +
        `Please add their Xero Contact ID to the customer record before pushing this invoice.`
      )
    }

    // Basic UUID format validation
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(xeroContactId)) {
      throw new Error(
        `Customer "${customer.name}" has an invalid Xero Reference format. ` +
        `Expected a UUID (e.g. 09654b8c-2767-43b5-9fbe-1af48fdaa8a0).`
      )
    }

    return xeroContactId
  }

  /**
   * Push a single Engage invoice to Xero.
   *
   * CRITICAL: Only sell prices (unit_price) are sent — NEVER cost/buy price.
   */
  async pushInvoice(invoiceId: string): Promise<XeroPushResult> {
    const supabase = createAdminClient()

    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_lines(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (!invoice) return { success: false, error: 'Invoice not found' }
    if (invoice.status !== 'sent') return { success: false, error: 'Only sent invoices can be pushed to Xero' }
    if (invoice.invoice_type === 'proforma') return { success: false, error: 'Proforma invoices are not pushed to Xero' }

    try {
      await this.getToken()

      const xeroContactId = await this.resolveXeroContact(invoice.customer_id)

      // Build line items — sell prices ONLY (never cost/buy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lineItems = (invoice.invoice_lines as any[])
        .map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unit_price, // SELL PRICE ONLY
          accountCode: '200', // Default sales account
          taxType: invoice.vat_rate > 0 ? 'OUTPUT2' : 'NONE',
        }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const xeroType = invoice.invoice_type === 'credit_note' ? 'ACCRECCREDIT' : 'ACCREC' as any

      const xeroInvoicePayload = {
        type: xeroType,
        contact: { contactID: xeroContactId },
        date: new Date(invoice.created_at).toISOString().split('T')[0],
        dueDate: invoice.due_date ?? undefined,
        invoiceNumber: invoice.invoice_number,
        reference: invoice.customer_po ?? invoice.invoice_number,
        lineItems,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'AUTHORISED' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineAmountTypes: invoice.vat_rate > 0 ? 'Exclusive' as any : 'NoTax' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currencyCode: 'GBP' as any,
      }

      let xeroInvoiceId: string

      if (invoice.xero_invoice_id) {
        // Update existing
        const result = await this.xero.accountingApi.updateInvoice(
          this.credentials.tenant_id,
          invoice.xero_invoice_id,
          { invoices: [xeroInvoicePayload] }
        )
        xeroInvoiceId = result.body.invoices![0].invoiceID!
      } else {
        // Create new
        const result = await this.xero.accountingApi.createInvoices(
          this.credentials.tenant_id,
          { invoices: [xeroInvoicePayload] }
        )
        xeroInvoiceId = result.body.invoices![0].invoiceID!
      }

      // Write success back to Engage
      await supabase
        .from('invoices')
        .update({
          xero_invoice_id: xeroInvoiceId,
          xero_status: 'synced',
          xero_pushed_at: new Date().toISOString(),
          xero_last_synced: new Date().toISOString(),
          xero_error: null,
          xero_push_attempts: (invoice.xero_push_attempts ?? 0) + 1,
        })
        .eq('id', invoiceId)

      return { success: true, xero_invoice_id: xeroInvoiceId }
    } catch (err: unknown) {
      // Write failure — never throw upward
      let errorMessage: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = err as any
      if (anyErr?.response?.body) {
        errorMessage = JSON.stringify(anyErr.response.body).slice(0, 500)
      } else if (err instanceof Error) {
        errorMessage = err.message
      } else {
        errorMessage = 'Unknown Xero error'
      }

      await supabase
        .from('invoices')
        .update({
          xero_status: 'failed',
          xero_pushed_at: new Date().toISOString(),
          xero_error: errorMessage,
          xero_push_attempts: (invoice.xero_push_attempts ?? 0) + 1,
        })
        .eq('id', invoiceId)

      return { success: false, error: errorMessage }
    }
  }
}

/**
 * Factory: load credentials from org_settings and return a configured client.
 * Returns null if Xero is not configured or not enabled.
 */
export async function getXeroClient(orgId: string): Promise<EngageXeroClient | null> {
  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .in('setting_key', ['xero_credentials', 'xero_enabled'])

  if (!settings) return null

  const enabled = settings.find(s => s.setting_key === 'xero_enabled')?.setting_value
  if (enabled !== 'true') return null

  const credsRaw = settings.find(s => s.setting_key === 'xero_credentials')?.setting_value
  if (!credsRaw) return null

  let credentials: XeroCredentials
  try {
    credentials = JSON.parse(credsRaw as string)
  } catch {
    return null
  }

  if (!credentials.client_id || !credentials.client_secret || !credentials.tenant_id) return null

  return new EngageXeroClient(credentials)
}
