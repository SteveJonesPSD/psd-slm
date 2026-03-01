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
  is_active: boolean
  must_change_password: boolean
  auth_id: string | null
  created_at: string
  updated_at: string
}

// --- Customers & Contacts ---

export interface Customer {
  id: string
  org_id: string
  name: string
  account_number: string | null
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
  is_active: boolean
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
  status: 'draft' | 'review' | 'sent' | 'accepted' | 'declined' | 'expired' | 'superseded'
  version: number
  parent_quote_id: string | null
  quote_type: 'business' | 'education' | 'charity' | 'public_sector' | null
  valid_until: string | null
  vat_rate: number
  customer_notes: string | null
  internal_notes: string | null
  customer_po: string | null
  portal_token: string | null
  accepted_at: string | null
  sent_at: string | null
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
  status: 'pending' | 'ordered' | 'received' | 'delivered' | 'cancelled'
  serial_numbers: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

// --- Purchase Orders ---

export interface PurchaseOrder {
  id: string
  org_id: string
  sales_order_id: string
  supplier_id: string
  po_number: string
  status: 'draft' | 'sent' | 'acknowledged' | 'partially_received' | 'received' | 'cancelled'
  supplier_ref: string | null
  expected_delivery_date: string | null
  delivery_instructions: string | null
  notes: string | null
  sent_at: string | null
  received_at: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderLine {
  id: string
  purchase_order_id: string
  sales_order_line_id: string
  product_id: string | null
  sort_order: number
  description: string
  quantity: number
  unit_cost: number
  quantity_received: number
  serial_numbers: string[] | null
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
  subtotal: number
  vat_amount: number
  total: number
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  sales_order_line_id: string | null
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  vat_rate: number
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
