export interface PortalContext {
  portalUserId: string
  customerId: string
  orgId: string
  contactId: string
  isPortalAdmin: boolean
  isGroupAdmin: boolean
  displayName: string
  customerName: string
  isImpersonation?: boolean
  viewingAsCustomerId?: string | null
  viewingAsCustomerName?: string | null
  portalLogoUrl?: string | null
  orgName?: string
  agentAvatars?: { helen: string | null; jasper: string | null; lucia: string | null }
}

export interface PortalUser {
  id: string
  orgId: string
  contactId: string
  customerId: string
  isPortalAdmin: boolean
  isActive: boolean
  lastLoginAt: string | null
  invitedBy: string | null
  invitedAt: string | null
  createdAt: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string | null
  customerName?: string
}

export interface PortalSession {
  id: string
  portalUserId: string
  customerId: string
  orgId: string
  sessionToken: string
  expiresAt: string
  lastActiveAt: string
}

export interface PortalQuote {
  id: string
  quoteNumber: string
  title: string | null
  status: string
  createdAt: string
  validUntil: string | null
  customerNotes: string | null
  totalExVat: number
  totalIncVat: number
  vatRate: number
}

export interface PortalQuoteLine {
  id: string
  groupId: string | null
  groupName: string | null
  description: string
  quantity: number
  sellPrice: number
  isOptional: boolean
  sortOrder: number
  isHiddenService: boolean
}

export interface PortalQuoteGroup {
  id: string
  name: string
  sortOrder: number
}

export interface PortalOrder {
  id: string
  soNumber: string
  createdAt: string
  status: string
  portalStatus: string
  notes: string | null
  totalSell: number
  quoteNumber: string | null
  quoteId: string | null
}

export interface PortalOrderLine {
  id: string
  description: string
  quantity: number
  sellPrice: number
  status: string
}

export interface PortalTicket {
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  assignedToName: string | null
}

export interface PortalTicketMessage {
  id: string
  content: string
  isInternal: false
  authorName: string
  authorType: 'agent' | 'customer'
  createdAt: string
}

export interface PortalVisit {
  id: string
  scheduledDate: string
  timeSlot: string
  startTime: string | null
  endTime: string | null
  status: string
  contractReference: string | null
  engineerName: string | null
  notes: string | null
}

export interface PortalContract {
  id: string
  name: string
  contractType: string
  startDate: string
  endDate: string | null
  renewalDate: string | null
  status: string
  entitlementSummary: string | null
}

export interface PortalInvoice {
  id: string
  invoiceNumber: string
  invoiceType: string
  createdAt: string
  sentAt: string | null
  dueDate: string | null
  status: string
  portalStatus: string
  subtotal: number
  vatAmount: number
  total: number
  customerPo: string | null
  soNumber: string | null
  soId: string | null
  paidAt: string | null
}

export interface PortalInvoiceLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  groupName: string | null
}

export interface PortalContactItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  portalStatus: 'active' | 'invited' | 'none'
  portalUserId: string | null
  isPortalAdmin: boolean
  lastLoginAt: string | null
}
