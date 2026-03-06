export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: Organisation
        Insert: Omit<Organisation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Organisation, 'id'>>
      }
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id'>>
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Customer, 'id'>>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Contact, 'id'>>
      }
      product_categories: {
        Row: ProductCategory
        Insert: Omit<ProductCategory, 'id' | 'created_at'>
        Update: Partial<Omit<ProductCategory, 'id'>>
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Supplier, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id'>>
      }
      product_suppliers: {
        Row: ProductSupplier
        Insert: Omit<ProductSupplier, 'id' | 'created_at'>
        Update: Partial<Omit<ProductSupplier, 'id'>>
      }
      supplier_integrations: {
        Row: SupplierIntegration
        Insert: Omit<SupplierIntegration, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SupplierIntegration, 'id'>>
      }
      deal_registrations: {
        Row: DealRegistration
        Insert: Omit<DealRegistration, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DealRegistration, 'id'>>
      }
      deal_registration_lines: {
        Row: DealRegistrationLine
        Insert: Omit<DealRegistrationLine, 'id' | 'created_at'>
        Update: Partial<Omit<DealRegistrationLine, 'id'>>
      }
      opportunities: {
        Row: Opportunity
        Insert: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Opportunity, 'id'>>
      }
      quotes: {
        Row: Quote
        Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Quote, 'id'>>
      }
      quote_groups: {
        Row: QuoteGroup
        Insert: Omit<QuoteGroup, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteGroup, 'id'>>
      }
      quote_lines: {
        Row: QuoteLine
        Insert: Omit<QuoteLine, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteLine, 'id'>>
      }
      quote_attributions: {
        Row: QuoteAttribution
        Insert: Omit<QuoteAttribution, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteAttribution, 'id'>>
      }
      quote_change_requests: {
        Row: QuoteChangeRequest
        Insert: Omit<QuoteChangeRequest, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<QuoteChangeRequest, 'id'>>
      }
      sales_orders: {
        Row: SalesOrder
        Insert: Omit<SalesOrder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SalesOrder, 'id'>>
      }
      sales_order_lines: {
        Row: SalesOrderLine
        Insert: Omit<SalesOrderLine, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SalesOrderLine, 'id'>>
      }
      purchase_orders: {
        Row: PurchaseOrder
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PurchaseOrder, 'id'>>
      }
      purchase_order_lines: {
        Row: PurchaseOrderLine
        Insert: Omit<PurchaseOrderLine, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PurchaseOrderLine, 'id'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Invoice, 'id'>>
      }
      invoice_lines: {
        Row: InvoiceLine
        Insert: Omit<InvoiceLine, 'id' | 'created_at'>
        Update: Partial<Omit<InvoiceLine, 'id'>>
      }
      commission_rates: {
        Row: CommissionRate
        Insert: Omit<CommissionRate, 'id' | 'created_at'>
        Update: Partial<Omit<CommissionRate, 'id'>>
      }
      commission_entries: {
        Row: CommissionEntry
        Insert: Omit<CommissionEntry, 'id' | 'created_at'>
        Update: Partial<Omit<CommissionEntry, 'id'>>
      }
      roles: {
        Row: Role
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Role, 'id'>>
      }
      permissions: {
        Row: Permission
        Insert: Omit<Permission, 'id' | 'created_at'>
        Update: Partial<Omit<Permission, 'id'>>
      }
      role_permissions: {
        Row: RolePermission
        Insert: Omit<RolePermission, 'created_at'>
        Update: never
      }
      activity_log: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at'>
        Update: Partial<Omit<ActivityLog, 'id'>>
      }
      gias_schools: {
        Row: GiasSchool
        Insert: Omit<GiasSchool, 'updated_at'>
        Update: Partial<GiasSchool>
      }
      org_settings: {
        Row: OrgSetting
        Insert: Omit<OrgSetting, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OrgSetting, 'id'>>
      }
      brands: {
        Row: Brand
        Insert: Omit<Brand, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Brand, 'id'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Notification, 'id'>>
      }
      quote_templates: {
        Row: QuoteTemplate
        Insert: Omit<QuoteTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<QuoteTemplate, 'id'>>
      }
      quote_template_groups: {
        Row: QuoteTemplateGroup
        Insert: Omit<QuoteTemplateGroup, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteTemplateGroup, 'id'>>
      }
      quote_template_lines: {
        Row: QuoteTemplateLine
        Insert: Omit<QuoteTemplateLine, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteTemplateLine, 'id'>>
      }
      inbound_purchase_orders: {
        Row: InboundPurchaseOrder
        Insert: Omit<InboundPurchaseOrder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<InboundPurchaseOrder, 'id'>>
      }
      inbound_po_lines: {
        Row: InboundPOLine
        Insert: Omit<InboundPOLine, 'id' | 'created_at'>
        Update: Partial<Omit<InboundPOLine, 'id'>>
      }
      ticket_categories: {
        Row: TicketCategory
        Insert: Omit<TicketCategory, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TicketCategory, 'id'>>
      }
      ticket_tags: {
        Row: TicketTag
        Insert: Omit<TicketTag, 'id' | 'created_at'>
        Update: Partial<Omit<TicketTag, 'id'>>
      }
      sla_plans: {
        Row: SlaPlan
        Insert: Omit<SlaPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SlaPlan, 'id'>>
      }
      sla_plan_targets: {
        Row: SlaPlanTarget
        Insert: Omit<SlaPlanTarget, 'id' | 'created_at'>
        Update: Partial<Omit<SlaPlanTarget, 'id'>>
      }
      support_contracts: {
        Row: SupportContract
        Insert: Omit<SupportContract, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SupportContract, 'id'>>
      }
      tickets: {
        Row: Ticket
        Insert: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Ticket, 'id'>>
      }
      ticket_messages: {
        Row: TicketMessage
        Insert: Omit<TicketMessage, 'id' | 'created_at'>
        Update: Partial<Omit<TicketMessage, 'id'>>
      }
      ticket_attachments: {
        Row: TicketAttachment
        Insert: Omit<TicketAttachment, 'id' | 'created_at'>
        Update: Partial<Omit<TicketAttachment, 'id'>>
      }
      ticket_tag_assignments: {
        Row: TicketTagAssignment
        Insert: Omit<TicketTagAssignment, 'created_at'>
        Update: never
      }
      ticket_watchers: {
        Row: TicketWatcher
        Insert: Omit<TicketWatcher, 'created_at'>
        Update: never
      }
      ticket_time_entries: {
        Row: TicketTimeEntry
        Insert: Omit<TicketTimeEntry, 'id' | 'created_at'>
        Update: Partial<Omit<TicketTimeEntry, 'id'>>
      }
      sla_events: {
        Row: SlaEvent
        Insert: Omit<SlaEvent, 'id' | 'created_at'>
        Update: Partial<Omit<SlaEvent, 'id'>>
      }
      ticket_custom_fields: {
        Row: TicketCustomField
        Insert: Omit<TicketCustomField, 'id' | 'created_at'>
        Update: Partial<Omit<TicketCustomField, 'id'>>
      }
      ticket_custom_field_values: {
        Row: TicketCustomFieldValue
        Insert: Omit<TicketCustomFieldValue, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TicketCustomFieldValue, 'id'>>
      }
      canned_responses: {
        Row: CannedResponse
        Insert: Omit<CannedResponse, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CannedResponse, 'id'>>
      }
      kb_categories: {
        Row: KbCategory
        Insert: Omit<KbCategory, 'id' | 'created_at'>
        Update: Partial<Omit<KbCategory, 'id'>>
      }
      kb_articles: {
        Row: KbArticle
        Insert: Omit<KbArticle, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<KbArticle, 'id'>>
      }
      kb_article_ratings: {
        Row: KbArticleRating
        Insert: Omit<KbArticleRating, 'id' | 'created_at'>
        Update: Partial<Omit<KbArticleRating, 'id'>>
      }
      automation_macros: {
        Row: AutomationMacro
        Insert: Omit<AutomationMacro, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AutomationMacro, 'id'>>
      }
      triage_log: {
        Row: TriageLog
        Insert: Omit<TriageLog, 'id' | 'created_at'>
        Update: Partial<Omit<TriageLog, 'id'>>
      }
      helen_draft_responses: {
        Row: HelenDraftResponse
        Insert: Omit<HelenDraftResponse, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<HelenDraftResponse, 'id'>>
      }
      departments: {
        Row: Department
        Insert: Omit<Department, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Department, 'id'>>
      }
      department_members: {
        Row: DepartmentMember
        Insert: Omit<DepartmentMember, 'id' | 'created_at'>
        Update: Partial<Omit<DepartmentMember, 'id'>>
      }
      helen_assist_log: {
        Row: HelenAssistLog
        Insert: Omit<HelenAssistLog, 'id' | 'created_at'>
        Update: Partial<Omit<HelenAssistLog, 'id'>>
      }
      ticket_scratchpad_notes: {
        Row: TicketScratchpadNote
        Insert: Omit<TicketScratchpadNote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TicketScratchpadNote, 'id'>>
      }
      stock_locations: {
        Row: StockLocation
        Insert: Omit<StockLocation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StockLocation, 'id'>>
      }
      stock_levels: {
        Row: StockLevel
        Insert: Omit<StockLevel, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StockLevel, 'id'>>
      }
      stock_movements: {
        Row: StockMovement
        Insert: Omit<StockMovement, 'id' | 'created_at'>
        Update: Partial<Omit<StockMovement, 'id'>>
      }
      stock_allocations: {
        Row: StockAllocation
        Insert: Omit<StockAllocation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StockAllocation, 'id'>>
      }
      serial_number_registry: {
        Row: SerialNumberEntry
        Insert: Omit<SerialNumberEntry, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SerialNumberEntry, 'id'>>
      }
      stock_takes: {
        Row: StockTake
        Insert: Omit<StockTake, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StockTake, 'id'>>
      }
      stock_take_lines: {
        Row: StockTakeLine
        Insert: Omit<StockTakeLine, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StockTakeLine, 'id'>>
      }
      delivery_notes: {
        Row: DeliveryNote
        Insert: Omit<DeliveryNote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DeliveryNote, 'id'>>
      }
      delivery_note_lines: {
        Row: DeliveryNoteLine
        Insert: Omit<DeliveryNoteLine, 'id' | 'created_at'>
        Update: Partial<Omit<DeliveryNoteLine, 'id'>>
      }
    }
    Views: {
      v_margin_traceability: {
        Row: MarginTraceability
      }
      v_commission_summary: {
        Row: CommissionSummary
      }
      v_active_deal_pricing: {
        Row: ActiveDealPricing
      }
      v_ticket_summary: {
        Row: TicketSummary
      }
      v_agent_workload: {
        Row: AgentWorkload
      }
      v_sla_compliance: {
        Row: SlaCompliance
      }
      v_helen_assist_usage: {
        Row: HelenAssistUsage
      }
      v_stock_availability: {
        Row: StockAvailability
      }
      v_so_line_fulfilment: {
        Row: SoLineFulfilment
      }
    }
    Functions: {
      clear_must_change_password: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}

// --- Core Entities ---

export interface Organisation {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  org_id: string
  email: string
  first_name: string
  last_name: string
  role_id: string
  initials: string | null
  color: string | null
  avatar_url: string | null
  is_active: boolean
  must_change_password: boolean
  auth_id: string | null
  ai_preferences: Record<string, string> | null
  created_at: string
  updated_at: string
}

// --- Customers & Contacts ---

export interface Customer {
  id: string
  org_id: string
  name: string
  account_number: string | null
  xero_reference: string | null
  customer_type: 'education' | 'business' | 'charity' | null
  dfe_number: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  payment_terms: number
  vat_number: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  customer_id: string
  first_name: string
  last_name: string
  job_title: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  is_primary: boolean
  is_billing: boolean
  is_shipping: boolean
  is_portal_user: boolean
  is_portal_admin: boolean
  is_active: boolean
  is_overseer: boolean
  is_auto_created: boolean
  portal_auth_id: string | null
  created_at: string
  updated_at: string
}

// --- Products & Suppliers ---

export interface ProductCategory {
  id: string
  org_id: string
  name: string
  requires_serial: boolean
  sort_order: number
  created_at: string
}

export interface Supplier {
  id: string
  org_id: string
  name: string
  account_number: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  country: string | null
  payment_terms: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  org_id: string
  category_id: string | null
  sku: string
  name: string
  description: string | null
  manufacturer: string | null
  default_buy_price: number | null
  default_sell_price: number | null
  is_serialised: boolean | null
  is_stocked: boolean
  is_active: boolean
  product_type: 'goods' | 'service'
  default_delivery_destination: 'psd_office' | 'customer_site'
  default_route: 'from_stock' | 'drop_ship'
  created_at: string
  updated_at: string
}

export interface ProductSupplier {
  id: string
  product_id: string
  supplier_id: string
  supplier_sku: string | null
  standard_cost: number | null
  lead_time_days: number | null
  is_preferred: boolean
  url: string | null
  created_at: string
}

export interface SupplierIntegration {
  id: string
  org_id: string
  supplier_id: string
  integration_type: 'manual' | 'api' | 'csv_import'
  api_base_url: string | null
  auth_config: Record<string, unknown>
  capabilities: string[]
  mapping_config: Record<string, unknown>
  is_active: boolean
  last_sync_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// --- Deal Registrations ---

export interface DealRegistration {
  id: string
  org_id: string
  customer_id: string
  supplier_id: string
  reference: string | null
  title: string
  status: 'pending' | 'active' | 'expired' | 'rejected'
  registered_date: string | null
  expiry_date: string | null
  notes: string | null
  registered_by: string | null
  created_at: string
  updated_at: string
}

export interface DealRegistrationLine {
  id: string
  deal_reg_id: string
  product_id: string
  registered_buy_price: number
  max_quantity: number | null
  notes: string | null
  created_at: string
}

// --- Sales Pipeline ---

export interface Opportunity {
  id: string
  org_id: string
  customer_id: string
  contact_id: string | null
  assigned_to: string | null
  title: string
  stage: 'prospecting' | 'qualifying' | 'proposal' | 'negotiation' | 'won' | 'lost'
  estimated_value: number | null
  probability: number
  expected_close_date: string | null
  lost_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// --- Quotes ---

export interface Quote {
  id: string
  org_id: string
  opportunity_id: string | null
  customer_id: string
  contact_id: string | null
  assigned_to: string | null
  quote_number: string
  title: string | null
  status: 'draft' | 'review' | 'sent' | 'accepted' | 'declined' | 'expired' | 'superseded' | 'revised'
  version: number
  parent_quote_id: string | null
  quote_type: 'business' | 'education' | 'charity' | 'public_sector' | null
  valid_until: string | null
  vat_rate: number
  customer_notes: string | null
  internal_notes: string | null
  customer_po: string | null
  portal_token: string | null
  decline_reason: string | null
  po_document_path: string | null
  base_quote_number: string
  status_before_revised: string | null
  brand_id: string | null
  accepted_at: string | null
  sent_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
  revision_notes: string | null
  signature_image_path: string | null
  signed_by_name: string | null
  created_at: string
  updated_at: string
}

export interface QuoteGroup {
  id: string
  quote_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface QuoteLine {
  id: string
  quote_id: string
  group_id: string | null
  product_id: string | null
  supplier_id: string | null
  deal_reg_line_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  is_optional: boolean
  requires_contract: boolean
  notes: string | null
  created_at: string
}

export interface QuoteAttribution {
  id: string
  quote_id: string
  user_id: string
  attribution_type: 'direct' | 'involvement' | 'override'
  split_pct: number
  created_at: string
}

// --- Quote Change Requests ---

export interface QuoteChangeRequest {
  id: string
  quote_id: string
  requested_by: string
  request_type: 'pricing' | 'specification' | 'quantity' | 'general'
  message: string
  status: 'pending' | 'resolved'
  internal_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// --- Sales Orders ---

export interface SalesOrder {
  id: string
  org_id: string
  quote_id: string
  customer_id: string
  contact_id: string | null
  so_number: string
  status: 'pending' | 'confirmed' | 'in_progress' | 'partially_fulfilled' | 'fulfilled' | 'cancelled'
  customer_po: string | null
  delivery_address_line1: string | null
  delivery_address_line2: string | null
  delivery_city: string | null
  delivery_postcode: string | null
  vat_rate: number
  notes: string | null
  confirmed_at: string | null
  fulfilled_at: string | null
  requested_delivery_date: string | null
  requires_install: boolean
  requested_install_date: string | null
  install_notes: string | null
  linked_visit_instance_id: string | null
  quote_number: string | null
  assigned_to: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface SalesOrderLine {
  id: string
  sales_order_id: string
  quote_line_id: string | null
  product_id: string | null
  supplier_id: string | null
  deal_reg_line_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  requires_contract: boolean
  status: 'pending' | 'picked' | 'ordered' | 'partial_received' | 'received' | 'delivered' | 'cancelled'
  delivery_destination: 'psd_office' | 'customer_site' | null
  group_name: string | null
  group_sort: number
  quantity_received: number
  serial_numbers_received: string[]
  is_service: boolean
  serial_numbers: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

// --- Purchase Orders ---

export interface PurchaseOrder {
  id: string
  org_id: string
  sales_order_id: string | null
  supplier_id: string
  po_number: string
  status: 'draft' | 'sent' | 'acknowledged' | 'partially_received' | 'received' | 'cancelled'
  purchase_type: 'customer_order' | 'stock_order'
  supplier_ref: string | null
  expected_delivery_date: string | null
  delivery_instructions: string | null
  delivery_destination: 'psd_office' | 'customer_site'
  delivery_address_line1: string | null
  delivery_address_line2: string | null
  delivery_city: string | null
  delivery_postcode: string | null
  delivery_cost: number
  created_by: string | null
  notes: string | null
  sent_at: string | null
  received_at: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderLine {
  id: string
  purchase_order_id: string
  sales_order_line_id: string | null
  product_id: string | null
  sort_order: number
  description: string
  quantity: number
  unit_cost: number
  quantity_received: number
  serial_numbers: string[] | null
  status: 'pending' | 'ordered' | 'partial_received' | 'received' | 'cancelled'
  notes: string | null
  received_at: string | null
  created_at: string
  updated_at: string
}

// --- Invoicing ---

export interface Invoice {
  id: string
  org_id: string
  sales_order_id: string
  customer_id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'credit_note'
  invoice_type: 'standard' | 'proforma' | 'credit_note'
  subtotal: number
  vat_amount: number
  total: number
  vat_rate: number
  due_date: string | null
  paid_at: string | null
  sent_at: string | null
  notes: string | null
  internal_notes: string | null
  brand_id: string | null
  quote_id: string | null
  contact_id: string | null
  parent_invoice_id: string | null
  customer_po: string | null
  payment_terms: number | null
  xero_invoice_id: string | null
  xero_status: string | null
  xero_last_synced: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  sales_order_line_id: string | null
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  vat_rate: number
  sort_order: number
  group_name: string | null
  created_at: string
}

// --- Commission ---

export interface CommissionRate {
  id: string
  org_id: string
  user_id: string | null
  quote_type: string | null
  rate_pct: number
  min_margin_pct: number | null
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface CommissionEntry {
  id: string
  org_id: string
  user_id: string
  invoice_id: string
  invoice_line_id: string
  quote_id: string | null
  attribution_type: string
  split_pct: number
  line_revenue: number
  line_cost: number
  line_margin: number
  commission_base: number
  commission_rate: number
  commission_amount: number
  period: string | null
  status: 'pending' | 'approved' | 'paid'
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

// --- Roles & Permissions ---

export interface Role {
  id: string
  org_id: string
  name: string
  display_name: string
  description: string | null
  is_system: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  module: string
  action: string
  description: string | null
  created_at: string
}

export interface RolePermission {
  role_id: string
  permission_id: string
  created_at: string
}

// --- Activity Log ---

export interface ActivityLog {
  id: string
  org_id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  details: Json | null
  created_at: string
}

// --- GIAS Schools ---

export interface GiasSchool {
  urn: string
  establishment_name: string
  street: string | null
  locality: string | null
  address3: string | null
  town: string | null
  county: string | null
  postcode: string | null
  phone: string | null
  website: string | null
  head_first_name: string | null
  head_last_name: string | null
  head_title: string | null
  type_of_establishment: string | null
  phase_of_education: string | null
  la_code: string | null
  la_name: string | null
  establishment_number: string | null
  status: string | null
  updated_at: string
}

// --- Views ---

export interface MarginTraceability {
  quote_line_id: string
  quote_number: string
  customer_id: string
  customer_name: string
  so_line_id: string | null
  so_number: string | null
  po_line_id: string | null
  po_number: string | null
  invoice_line_id: string | null
  invoice_number: string | null
  description: string
  quantity: number
  quoted_buy: number
  quoted_sell: number
  ordered_buy: number | null
  ordered_sell: number | null
  actual_cost: number | null
  invoiced_sell: number | null
  invoiced_cost: number | null
  actual_margin: number | null
  margin_pct: number | null
  deal_reg_ref: string | null
  deal_reg_title: string | null
}

export interface CommissionSummary {
  user_id: string
  user_name: string
  period: string | null
  total_revenue: number
  total_cost: number
  total_margin: number
  total_commission: number
  invoice_count: number
  status: string
}

export interface ActiveDealPricing {
  deal_reg_id: string
  deal_reg_line_id: string
  customer_id: string
  customer_name: string
  supplier_id: string
  supplier_name: string
  reference: string | null
  title: string
  expiry_date: string | null
  product_id: string
  sku: string
  product_name: string
  standard_cost: number | null
  deal_cost: number
  saving_per_unit: number | null
  max_quantity: number | null
}

// --- Settings & Brands ---

export interface OrgSetting {
  id: string
  org_id: string
  category: string
  setting_key: string
  setting_value: Json | null
  is_secret: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface Brand {
  id: string
  org_id: string
  name: string
  is_default: boolean
  legal_entity: string | null
  company_reg_number: string | null
  vat_number: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  country: string
  phone: string | null
  fax: string | null
  email: string | null
  website: string | null
  logo_path: string | null
  logo_width: number
  footer_text: string | null
  registered_address: string | null
  default_terms: string | null
  default_payment_terms_text: string | null
  customer_type: 'education' | 'business' | 'charity' | 'public_sector' | null
  quote_prefix: string
  use_for_pos: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// --- Notifications ---

export interface Notification {
  id: string
  org_id: string
  user_id: string
  type: string
  title: string
  message: string
  link: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
  updated_at: string
}

// --- Quote Templates ---

export interface QuoteTemplate {
  id: string
  org_id: string
  name: string
  description: string | null
  category: string | null
  default_quote_type: 'business' | 'education' | 'charity' | 'public_sector' | null
  is_active: boolean
  created_by: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QuoteTemplateGroup {
  id: string
  template_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface QuoteTemplateLine {
  id: string
  template_id: string
  group_id: string | null
  product_id: string | null
  supplier_id: string | null
  sort_order: number
  description: string
  quantity: number
  default_buy_price: number
  default_sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  is_optional: boolean
  requires_contract: boolean
  notes: string | null
  created_at: string
}

// --- Inbound Purchase Orders ---

export interface InboundPurchaseOrder {
  id: string
  org_id: string
  source: 'upload' | 'email'
  original_filename: string | null
  pdf_storage_path: string | null
  extraction_method: 'text_layer' | 'ocr_vision' | null
  extraction_confidence: 'high' | 'medium' | 'low' | 'failed' | null
  raw_extracted_text: string | null
  extracted_data: Json | null
  customer_po_number: string | null
  customer_name: string | null
  contact_name: string | null
  po_date: string | null
  total_value: number | null
  delivery_address: string | null
  special_instructions: string | null
  our_reference: string | null
  matched_company_id: string | null
  matched_quote_id: string | null
  match_confidence: 'exact' | 'high' | 'low' | 'none' | null
  match_method: string | null
  status: 'uploading' | 'extracting' | 'pending_review' | 'matched' | 'processing' | 'completed' | 'rejected' | 'error'
  error_message: string | null
  reject_reason: string | null
  internal_notes: string | null
  uploaded_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  sales_order_id: string | null
  created_at: string
  updated_at: string
}

export interface InboundPOLine {
  id: string
  inbound_po_id: string
  line_number: number | null
  description: string | null
  quantity: number | null
  unit_price: number | null
  line_total: number | null
  product_code: string | null
  override_description: string | null
  override_quantity: number | null
  override_unit_price: number | null
  matched_quote_line_id: string | null
  line_match_confidence: 'exact' | 'high' | 'low' | 'none' | null
  sort_order: number
  created_at: string
}

// --- Helpdesk & Ticketing ---

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'waiting_on_customer' | 'escalated' | 'resolved' | 'closed' | 'cancelled'
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low'
export type TicketType = 'helpdesk' | 'onsite_job'
export type ContractType = 'helpdesk' | 'onsite' | 'both'

export interface TicketCategory {
  id: string
  org_id: string
  parent_id: string | null
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TicketTag {
  id: string
  org_id: string
  name: string
  color: string
  is_ai_assignable: boolean
  is_active: boolean
  created_at: string
}

export interface SlaPlan {
  id: string
  org_id: string
  name: string
  description: string | null
  business_hours_start: string
  business_hours_end: string
  business_days: number[]
  is_24x7: boolean
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SlaPlanTarget {
  id: string
  sla_plan_id: string
  priority: TicketPriority
  response_time_minutes: number
  resolution_time_minutes: number
  created_at: string
}

export interface SupportContract {
  id: string
  org_id: string
  customer_id: string
  sla_plan_id: string | null
  name: string
  contract_type: ContractType
  monthly_hours: number | null
  start_date: string
  end_date: string | null
  is_active: boolean
  onsite_engineer: string | null
  onsite_schedule: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  org_id: string
  ticket_number: string
  customer_id: string
  contact_id: string | null
  assigned_to: string | null
  brand_id: string | null
  category_id: string | null
  contract_id: string | null
  sla_plan_id: string | null
  subject: string
  description: string | null
  ticket_type: TicketType
  status: TicketStatus
  priority: TicketPriority
  sla_response_due_at: string | null
  sla_resolution_due_at: string | null
  first_responded_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_response_met: boolean | null
  sla_resolution_met: boolean | null
  sla_paused_at: string | null
  sla_paused_minutes: number
  escalation_level: number
  escalated_at: string | null
  escalated_by: string | null
  department_id: string | null
  site_location: string | null
  room_number: string | null
  device_details: string | null
  scheduled_date: string | null
  portal_token: string | null
  merged_into_ticket_id: string | null
  pre_merge_status: string | null
  hold_open: boolean
  waiting_since: string | null
  auto_close_warning_sent_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TicketMerge {
  id: string
  org_id: string
  source_ticket_id: string
  target_ticket_id: string
  merged_by: string
  merged_at: string
  source_snapshot: Record<string, unknown>
  unmerged_at: string | null
  unmerged_by: string | null
}

export interface TicketMessage {
  id: string
  ticket_id: string
  sender_type: 'agent' | 'customer' | 'system'
  sender_id: string | null
  sender_name: string | null
  body: string
  is_internal: boolean
  created_at: string
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  message_id: string | null
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
}

export interface QuoteAttachment {
  id: string
  quote_id: string
  org_id: string
  file_name: string
  storage_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  label: string | null
  source: 'manual' | 'supplier_import'
  created_at: string
}

export interface TicketTagAssignment {
  ticket_id: string
  tag_id: string
  created_at: string
}

export interface TicketWatcher {
  ticket_id: string
  user_id: string
  created_at: string
}

export interface TicketTimeEntry {
  id: string
  ticket_id: string
  user_id: string
  minutes: number
  description: string | null
  is_billable: boolean
  entry_date: string
  created_at: string
}

export interface SlaEvent {
  id: string
  ticket_id: string
  event_type: 'started' | 'paused' | 'resumed' | 'response_met' | 'response_breached' | 'resolution_met' | 'resolution_breached'
  event_data: Json | null
  created_at: string
}

export interface TicketCustomField {
  id: string
  org_id: string
  name: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean'
  options: Json | null
  is_required: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface TicketCustomFieldValue {
  id: string
  ticket_id: string
  field_id: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface CannedResponse {
  id: string
  org_id: string
  title: string
  body: string
  category: string | null
  is_shared: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KbCategory {
  id: string
  org_id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface KbArticle {
  id: string
  org_id: string
  category_id: string | null
  title: string
  slug: string
  body: string
  is_published: boolean
  is_internal: boolean
  view_count: number
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface KbArticleRating {
  id: string
  article_id: string
  is_helpful: boolean
  feedback: string | null
  created_at: string
}

// --- AI Triage & Automation ---

export type MacroTriggerType = 'tag_applied' | 'priority_set' | 'status_changed'

export interface MacroAction {
  type: 'escalate' | 'set_status' | 'notify_users' | 'notify_roles'
  level?: number
  status?: string
  user_ids?: string[]
  role_names?: string[]
}

export interface AutomationMacro {
  id: string
  org_id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  trigger_type: MacroTriggerType
  trigger_conditions: Json
  actions: MacroAction[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TriageLog {
  id: string
  ticket_id: string
  org_id: string
  tags_assigned: string[]
  tags_existing: string[]
  ai_reasoning: string | null
  macros_executed: string[]
  processing_time_ms: number | null
  error: string | null
  ack_sent: boolean
  draft_id: string | null
  draft_type: string | null
  tags_created: string[]
  auto_sent: boolean
  created_at: string
}

export type HelenDraftStatus = 'pending' | 'approved' | 'rejected' | 'auto_sent'
export type HelenDraftType = 'triage_response' | 'needs_detail'

export interface HelenDraftResponse {
  id: string
  ticket_id: string
  org_id: string
  draft_type: HelenDraftType
  body: string
  status: HelenDraftStatus
  ai_reasoning: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  edited_body: string | null
  message_id: string | null
  created_at: string
  updated_at: string
}

// --- Departments ---

export type EscalationType = 'sideways' | 'upward'
export type DepartmentMemberRole = 'manager' | 'member'

export interface Department {
  id: string
  org_id: string
  name: string
  description: string | null
  escalation_type: EscalationType
  priority_uplift: number
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface DepartmentMember {
  id: string
  department_id: string
  user_id: string
  role: DepartmentMemberRole
  created_at: string
}

// --- Helpdesk Views ---

export interface TicketSummary {
  id: string
  org_id: string
  ticket_number: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  ticket_type: TicketType
  created_at: string
  updated_at: string
  sla_response_due_at: string | null
  sla_resolution_due_at: string | null
  first_responded_at: string | null
  resolved_at: string | null
  sla_response_met: boolean | null
  sla_resolution_met: boolean | null
  escalation_level: number
  customer_id: string | null
  customer_name: string | null
  contact_id: string | null
  contact_name: string | null
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_to_initials: string | null
  assigned_to_color: string | null
  category_name: string | null
  brand_name: string | null
  brand_id: string | null
  category_id: string | null
  contract_id: string | null
  assigned_to: string | null
  created_by: string | null
  merged_into_ticket_id: string | null
  message_count: number
  total_time_minutes: number
  tone_score: number | null
  tone_trend: string | null
  tone_summary: string | null
  tone_updated_at: string | null
  source: 'manual' | 'portal' | 'email' | null
  customer_waiting: boolean | null
  needs_customer_assignment: boolean | null
}

// AutoGRUMP tone analysis
export type ToneTrend = 'escalating' | 'stable' | 'improving' | 'new'

export interface ToneAnalysisResult {
  score: number        // 1-5
  trend: ToneTrend
  summary: string      // One-line, max 100 chars
}

export interface AgentWorkload {
  user_id: string
  user_name: string
  initials: string | null
  color: string | null
  role_name: string
  open_tickets: number
  new_tickets: number
  urgent_tickets: number
  time_today_minutes: number
}

export interface SlaCompliance {
  org_id: string
  period: string
  total_tickets: number
  response_met: number
  response_breached: number
  resolution_met: number
  resolution_breached: number
  response_pct: number | null
  resolution_pct: number | null
}

// --- Onsite Scheduling ---

export type JobStatus = 'unscheduled' | 'scheduled' | 'travelling' | 'on_site' | 'completed' | 'cancelled'
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface JobType {
  id: string
  org_id: string
  name: string
  slug: string
  color: string
  background: string
  default_duration_minutes: number
  is_active: boolean
  sort_order: number
  task_template_id: string | null
  created_at: string
  updated_at: string
}

export interface JobTaskTemplate {
  id: string
  org_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TaskResponseType = 'yes_no' | 'text' | 'date'

export interface JobTaskTemplateItem {
  id: string
  template_id: string
  description: string
  is_required: boolean
  response_type: TaskResponseType
  sort_order: number
  created_at: string
}

export interface JobTask {
  id: string
  job_id: string
  template_item_id: string | null
  description: string
  is_required: boolean
  response_type: TaskResponseType
  sort_order: number
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  response_value: string | null
  notes: string | null
  created_at: string
}

export interface Job {
  id: string
  org_id: string
  job_number: string
  title: string
  description: string | null
  company_id: string
  contact_id: string | null
  site_address_line1: string | null
  site_address_line2: string | null
  site_city: string | null
  site_county: string | null
  site_postcode: string | null
  job_type_id: string
  priority: JobPriority
  status: JobStatus
  assigned_to: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  estimated_duration_minutes: number
  travel_started_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  completion_notes: string | null
  follow_up_required: boolean
  internal_notes: string | null
  cancel_reason: string | null
  validated_at: string | null
  validated_by: string | null
  validation_notes: string | null
  source_type: 'manual' | 'sales_order' | 'ticket' | 'contract' | 'visit'
  source_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface JobNote {
  id: string
  job_id: string
  user_id: string
  note: string
  created_at: string
  updated_at: string
}

export interface JobReport {
  id: string
  job_id: string
  org_id: string
  storage_path: string
  file_name: string
  generated_by: string
  sent_at: string | null
  sent_to: string | null
  created_at: string
}

export interface JobPhoto {
  id: string
  job_id: string
  user_id: string
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  caption: string | null
  created_at: string
}

export interface JobPart {
  id: string
  job_id: string
  product_id: string | null
  description: string | null
  quantity: number
  serial_numbers: string[] | null
  created_at: string
}

export interface CompanyJobHistory {
  id: string
  org_id: string
  company_id: string
  job_number: string
  title: string
  status: JobStatus
  priority: JobPriority
  scheduled_date: string | null
  completed_at: string | null
  completion_notes: string | null
  follow_up_required: boolean
  job_type_name: string
  job_type_slug: string
  job_type_color: string
  job_type_background: string
  engineer_first_name: string | null
  engineer_last_name: string | null
}

// ============================================================================
// TEAMS
// ============================================================================

export interface Team {
  id: string
  org_id: string
  name: string
  slug: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  created_at: string
}

// ============================================================================
// HELEN AI ASSIST
// ============================================================================

export interface HelenAssistLog {
  id: string
  ticket_id: string
  org_id: string
  user_id: string
  model: string
  input_tokens: number
  output_tokens: number
  request_summary: string | null
  response_body: string | null
  category_id: string | null
  created_at: string
}

export type ScratchpadSource = 'manual' | 'helen_assist'

export interface TicketScratchpadNote {
  id: string
  ticket_id: string
  org_id: string
  created_by: string
  source: ScratchpadSource
  assist_log_id: string | null
  title: string | null
  body: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface HelenAssistUsage {
  id: string
  org_id: string
  ticket_id: string
  user_id: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  category_id: string | null
  created_at: string
  ticket_number: string
  user_name: string
  category_name: string | null
}

// ============================================================================
// STOCK MANAGEMENT
// ============================================================================

export type StockMovementType = 'goods_received' | 'allocated' | 'deallocated' | 'picked' | 'adjustment_in' | 'adjustment_out' | 'stocktake_adjustment'
export type StockAllocationStatus = 'allocated' | 'partially_picked' | 'picked' | 'cancelled'
export type SerialNumberStatus = 'in_stock' | 'allocated' | 'dispatched' | 'returned'
export type StockTakeStatus = 'in_progress' | 'completed' | 'cancelled'
export type DeliveryNoteStatus = 'draft' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled'
export type FulfilmentStatus = 'needs_action' | 'covered' | 'ready'

export interface StockLocation {
  id: string
  org_id: string
  name: string
  code: string
  is_default: boolean
  is_active: boolean
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StockLevel {
  id: string
  org_id: string
  product_id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  reorder_point: number
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  org_id: string
  product_id: string
  location_id: string
  movement_type: StockMovementType
  quantity: number
  reference_type: string | null
  reference_id: string | null
  serial_numbers: string[]
  reason: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface StockAllocation {
  id: string
  org_id: string
  sales_order_line_id: string
  product_id: string
  location_id: string
  quantity_allocated: number
  quantity_picked: number
  serial_numbers: string[]
  status: StockAllocationStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SerialNumberEntry {
  id: string
  org_id: string
  product_id: string
  serial_number: string
  status: SerialNumberStatus
  location_id: string | null
  po_line_id: string | null
  so_line_id: string | null
  delivery_note_id: string | null
  received_at: string | null
  dispatched_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StockTake {
  id: string
  org_id: string
  st_number: string
  location_id: string
  status: StockTakeStatus
  notes: string | null
  started_by: string | null
  completed_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface StockTakeLine {
  id: string
  stock_take_id: string
  product_id: string
  expected_qty: number
  counted_qty: number | null
  variance: number
  serials_found: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DeliveryNote {
  id: string
  org_id: string
  sales_order_id: string
  dn_number: string
  status: DeliveryNoteStatus
  delivery_address_line1: string | null
  delivery_address_line2: string | null
  delivery_city: string | null
  delivery_postcode: string | null
  carrier: string | null
  tracking_reference: string | null
  notes: string | null
  confirmed_at: string | null
  dispatched_at: string | null
  delivered_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DeliveryNoteLine {
  id: string
  delivery_note_id: string
  sales_order_line_id: string | null
  product_id: string | null
  description: string
  quantity: number
  serial_numbers: string[]
  created_at: string
}

// --- Stock Views ---

export interface StockAvailability {
  id: string
  org_id: string
  product_id: string
  location_id: string
  sku: string
  product_name: string
  default_buy_price: number | null
  is_serialised: boolean | null
  is_stocked: boolean
  category_id: string | null
  category_name: string | null
  location_name: string
  location_code: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number
  below_reorder: boolean
}

export interface SoLineFulfilment {
  so_line_id: string
  sales_order_id: string
  product_id: string | null
  description: string
  required_qty: number
  fulfilment_route: string
  line_status: string
  is_service: boolean
  qty_allocated: number
  qty_picked: number
  qty_on_po: number
  qty_po_received: number
  qty_unallocated: number
  fulfilment_status: FulfilmentStatus
}

// --- Customer Email Domains ---

export interface CustomerEmailDomain {
  id: string
  org_id: string
  customer_id: string
  domain: string
  is_active: boolean
  created_at: string
  created_by: string | null
}

export interface SystemPresence {
  user_id: string
  org_id: string
  last_heartbeat: string
  last_active: string
}

// GPS types
export interface GpsCoords {
  latitude: number
  longitude: number
  accuracy: number | null
}

export type GpsEventType =
  | 'travel_started'
  | 'arrived'
  | 'completed'
  | 'note_added'
  | 'task_toggled'
  | 'photo_added'
  | 'status_changed'

export interface JobGpsLog {
  id: string
  job_id: string
  user_id: string
  org_id: string
  event_type: GpsEventType
  latitude: number
  longitude: number
  accuracy_metres: number | null
  captured_at: string
  metadata: Record<string, unknown> | null
  user?: { first_name: string; last_name: string }
}
