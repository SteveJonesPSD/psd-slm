export type EsignRequestType =
  | 'new_contract'
  | 'renewal_acceptance'
  | 'schedule_acceptance'

export type EsignRequestStatus =
  | 'pending'
  | 'signed'
  | 'declined'
  | 'expired'

export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'declined_signature'
  | 'awaiting_activation'
  | 'active'
  | 'renewal_flagged'
  | 'renewal_sent'
  | 'renewal_accepted'
  | 'schedule_pending'
  | 'not_renewing'
  | 'expired'
  | 'cancelled'
  | 'renewed'

export interface EsignRequest {
  id: string
  orgId: string
  contractId: string
  requestType: EsignRequestType
  status: EsignRequestStatus
  token: string
  documentPath: string | null
  signedDocumentPath: string | null
  signaturePath: string | null
  signerName: string | null
  signerEmail: string | null
  signedAt: string | null
  declinedAt: string | null
  declineNotes: string | null
  ipAddress: string | null
  expiresAt: string
  sentAt: string | null
  sentBy: string | null
  createdAt: string
  updatedAt: string
}

export interface EsignRequestWithContract extends EsignRequest {
  contract: {
    contractNumber: string
    customerId: string
    customerName: string
    contractTypeName: string
    startDate: string
    endDate: string | null
    annualValue: number | null
    status: string
  }
}

export interface RenewalFlag {
  id: string
  orgId: string
  contractId: string
  flagType: 'renewal_due' | 'renewal_overdue'
  daysRemaining: number
  flaggedAt: string
  actionedAt: string | null
  actionedBy: string | null
}

export interface RenewalFlagWithContract extends RenewalFlag {
  contract: {
    contractNumber: string
    customerId: string
    customerName: string
    contractTypeName: string
    endDate: string | null
    annualValue: number | null
    accountManagerId: string | null
    accountManagerName: string | null
  }
}

export interface EsignOrgConfig {
  defaultRenewalNoticeDays: number
  esignFromName: string
  esignExpiryDays: number
}

export const ESIGN_STATUS_CONFIG: Record<EsignRequestStatus, {
  label: string
  colour: string
}> = {
  pending:  { label: 'Pending',  colour: 'amber'  },
  signed:   { label: 'Signed',   colour: 'green'  },
  declined: { label: 'Declined', colour: 'red'    },
  expired:  { label: 'Expired',  colour: 'slate'  },
}

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, {
  label: string
  colour: string
}> = {
  draft:                { label: 'Draft',                colour: 'slate'  },
  pending_signature:    { label: 'Pending Signature',    colour: 'amber'  },
  declined_signature:   { label: 'Signature Declined',   colour: 'red'    },
  awaiting_activation:  { label: 'Awaiting Activation',  colour: 'blue'   },
  active:               { label: 'Active',               colour: 'green'  },
  renewal_flagged:      { label: 'Renewal Due',          colour: 'amber'  },
  renewal_sent:         { label: 'Renewal Sent',         colour: 'blue'   },
  renewal_accepted:     { label: 'Renewal Accepted',     colour: 'teal'   },
  schedule_pending:     { label: 'Schedule Pending',     colour: 'purple' },
  not_renewing:         { label: 'Not Renewing',         colour: 'red'    },
  expired:              { label: 'Expired',              colour: 'slate'  },
  cancelled:            { label: 'Cancelled',            colour: 'slate'  },
  renewed:              { label: 'Renewed',              colour: 'teal'   },
}
