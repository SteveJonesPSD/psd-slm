'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  EsignRequest,
  EsignRequestWithContract,
  EsignRequestType,
  EsignRequestStatus,
  EsignOrgConfig,
  ContractStatus,
  RenewalFlag,
  RenewalFlagWithContract,
} from './types'

// ============================================================
// Row → EsignRequest mapper
// ============================================================

function mapRowToEsignRequest(row: Record<string, unknown>): EsignRequest {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    contractId: row.contract_id as string,
    requestType: row.request_type as EsignRequestType,
    status: row.status as EsignRequestStatus,
    token: row.token as string,
    documentPath: (row.document_path as string) ?? null,
    signedDocumentPath: (row.signed_document_path as string) ?? null,
    signaturePath: (row.signature_path as string) ?? null,
    signerName: (row.signer_name as string) ?? null,
    signerEmail: (row.signer_email as string) ?? null,
    signedAt: (row.signed_at as string) ?? null,
    declinedAt: (row.declined_at as string) ?? null,
    declineNotes: (row.decline_notes as string) ?? null,
    ipAddress: (row.ip_address as string) ?? null,
    expiresAt: row.expires_at as string,
    sentAt: (row.sent_at as string) ?? null,
    sentBy: (row.sent_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapRowToRenewalFlag(row: Record<string, unknown>): RenewalFlag {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    contractId: row.contract_id as string,
    flagType: row.flag_type as 'renewal_due' | 'renewal_overdue',
    daysRemaining: row.days_remaining as number,
    flaggedAt: row.flagged_at as string,
    actionedAt: (row.actioned_at as string) ?? null,
    actionedBy: (row.actioned_by as string) ?? null,
  }
}

// ============================================================
// Read — E-sign Requests
// ============================================================

export async function getEsignRequest(id: string): Promise<EsignRequest | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_esign_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapRowToEsignRequest(data)
}

export async function getEsignRequestByToken(token: string): Promise<EsignRequestWithContract | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_esign_requests')
    .select(`
      *,
      customer_contracts!inner (
        contract_number,
        customer_id,
        status,
        start_date,
        end_date,
        annual_value,
        customers!inner ( name ),
        contract_types!inner ( name )
      )
    `)
    .eq('token', token)
    .single()

  if (error || !data) return null

  const contract = data.customer_contracts as Record<string, unknown>
  const customer = contract.customers as Record<string, unknown>
  const contractType = contract.contract_types as Record<string, unknown>

  return {
    ...mapRowToEsignRequest(data),
    contract: {
      contractNumber: contract.contract_number as string,
      customerId: contract.customer_id as string,
      customerName: customer.name as string,
      contractTypeName: contractType.name as string,
      startDate: contract.start_date as string,
      endDate: (contract.end_date as string) ?? null,
      annualValue: (contract.annual_value as number) ?? null,
      status: contract.status as string,
    },
  }
}

export async function getEsignRequestsForContract(contractId: string): Promise<EsignRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_esign_requests')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapRowToEsignRequest)
}

// ============================================================
// Read — Org Config
// ============================================================

export async function getEsignOrgConfig(orgId: string): Promise<EsignOrgConfig> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'esign')

  const settings: Record<string, string> = {}
  for (const row of data || []) {
    const val = row.setting_value
    // setting_value is JSONB — may be a quoted string or a number
    settings[row.setting_key] = typeof val === 'string' ? val : JSON.stringify(val)
  }

  return {
    defaultRenewalNoticeDays: parseInt(settings.default_renewal_notice_days ?? '60', 10) || 60,
    esignFromName: settings.esign_from_name?.replace(/^"|"$/g, '') || 'Contracts Team',
    esignExpiryDays: parseInt(settings.esign_expiry_days ?? '30', 10) || 30,
  }
}

// ============================================================
// Create — E-sign Request
// ============================================================

export async function createEsignRequest(input: {
  contractId: string
  requestType: EsignRequestType
  sentBy: string
  signerName: string
  signerEmail: string
  orgId: string
  documentPath?: string
}): Promise<EsignRequest> {
  const config = await getEsignOrgConfig(input.orgId)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + config.esignExpiryDays)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_esign_requests')
    .insert({
      org_id: input.orgId,
      contract_id: input.contractId,
      request_type: input.requestType,
      status: 'pending',
      signer_name: input.signerName,
      signer_email: input.signerEmail,
      document_path: input.documentPath ?? null,
      expires_at: expiresAt.toISOString(),
      sent_at: new Date().toISOString(),
      sent_by: input.sentBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create e-sign request: ${error?.message}`)
  }

  return mapRowToEsignRequest(data)
}

// ============================================================
// Sign / Decline / Expire
// ============================================================

export async function markRequestSigned(input: {
  requestId: string
  signerName: string
  signaturePath: string
  signedDocumentPath: string
  ipAddress: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('contract_esign_requests')
    .update({
      status: 'signed',
      signer_name: input.signerName,
      signature_path: input.signaturePath,
      signed_document_path: input.signedDocumentPath,
      signed_at: new Date().toISOString(),
      ip_address: input.ipAddress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)

  if (error) {
    throw new Error(`Failed to mark request signed: ${error.message}`)
  }
}

export async function markRequestDeclined(input: {
  requestId: string
  signerName: string
  declineNotes: string | null
  ipAddress: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('contract_esign_requests')
    .update({
      status: 'declined',
      signer_name: input.signerName,
      decline_notes: input.declineNotes,
      declined_at: new Date().toISOString(),
      ip_address: input.ipAddress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)

  if (error) {
    throw new Error(`Failed to mark request declined: ${error.message}`)
  }
}

export async function expireRequest(requestId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('contract_esign_requests')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to expire request: ${error.message}`)
  }
}

// ============================================================
// Contract Status
// ============================================================

export async function updateContractStatus(
  contractId: string,
  status: ContractStatus
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('customer_contracts')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (error) {
    throw new Error(`Failed to update contract status: ${error.message}`)
  }
}

// ============================================================
// Renewal Flags
// ============================================================

export async function createRenewalFlag(input: {
  contractId: string
  orgId: string
  daysRemaining: number
  flagType: 'renewal_due' | 'renewal_overdue'
}): Promise<RenewalFlag> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_renewal_flags')
    .insert({
      org_id: input.orgId,
      contract_id: input.contractId,
      flag_type: input.flagType,
      days_remaining: input.daysRemaining,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create renewal flag: ${error?.message}`)
  }

  return mapRowToRenewalFlag(data)
}

export async function actionRenewalFlag(flagId: string, actionedBy: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('contract_renewal_flags')
    .update({
      actioned_at: new Date().toISOString(),
      actioned_by: actionedBy,
    })
    .eq('id', flagId)

  if (error) {
    throw new Error(`Failed to action renewal flag: ${error.message}`)
  }
}

export async function getActiveRenewalFlags(orgId: string): Promise<RenewalFlagWithContract[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_renewal_flags')
    .select(`
      *,
      customer_contracts!inner (
        contract_number,
        customer_id,
        end_date,
        annual_value,
        account_manager_id,
        customers!inner ( name ),
        contract_types!inner ( name )
      )
    `)
    .eq('org_id', orgId)
    .is('actioned_at', null)
    .order('days_remaining', { ascending: true })

  if (error || !data) return []

  return data.map((row) => {
    const contract = row.customer_contracts as Record<string, unknown>
    const customer = contract.customers as Record<string, unknown>
    const contractType = contract.contract_types as Record<string, unknown>
    const accountManagerId = (contract.account_manager_id as string) ?? null

    return {
      ...mapRowToRenewalFlag(row),
      contract: {
        contractNumber: contract.contract_number as string,
        customerId: contract.customer_id as string,
        customerName: customer.name as string,
        contractTypeName: contractType.name as string,
        endDate: (contract.end_date as string) ?? null,
        annualValue: (contract.annual_value as number) ?? null,
        accountManagerId,
        accountManagerName: null, // Resolved separately if needed
      },
    }
  })
}

export async function getRenewalFlagsForContract(contractId: string): Promise<RenewalFlag[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contract_renewal_flags')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapRowToRenewalFlag)
}
