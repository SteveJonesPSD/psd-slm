-- ============================================================================
-- PSD GROUP - Sales Lifecycle Management (SLM) Platform
-- Database Schema v1.0
-- Target: PostgreSQL (Supabase)
-- ============================================================================

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

CREATE TABLE organisations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    email           TEXT UNIQUE NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'sales', 'tech', 'finance')),
    initials        TEXT,
    color           TEXT,
    is_active       BOOLEAN DEFAULT true,
    auth_id         UUID,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CUSTOMERS & CONTACTS
-- ============================================================================

CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    name            TEXT NOT NULL,
    account_number  TEXT,
    address_line1   TEXT,
    address_line2   TEXT,
    city            TEXT,
    county          TEXT,
    postcode        TEXT,
    country         TEXT DEFAULT 'GB',
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    payment_terms   INTEGER DEFAULT 30,
    vat_number      TEXT,
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    job_title       TEXT,
    email           TEXT,
    phone           TEXT,
    mobile          TEXT,
    is_primary      BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PRODUCTS & SUPPLIERS
-- ============================================================================

CREATE TABLE product_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    name            TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    name            TEXT NOT NULL,
    account_number  TEXT,
    email           TEXT,
    phone           TEXT,
    website         TEXT,
    payment_terms   INTEGER DEFAULT 30,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    category_id     UUID REFERENCES product_categories(id),
    sku             TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    manufacturer    TEXT,
    default_buy_price   NUMERIC(12,2),
    default_sell_price  NUMERIC(12,2),
    is_serialised   BOOLEAN DEFAULT false,
    is_stocked      BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, sku)
);

CREATE TABLE product_suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_sku    TEXT,
    standard_cost   NUMERIC(12,2),
    lead_time_days  INTEGER,
    is_preferred    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, supplier_id)
);

-- ============================================================================
-- DEAL REGISTRATIONS
-- ============================================================================
-- The KEY entity that other systems miss.
-- Links a CUSTOMER to a SUPPLIER for specific products at negotiated pricing.
-- When quoting for a customer with an active deal reg, buy prices
-- auto-populate from here instead of the product catalogue default.

CREATE TABLE deal_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    company_id      UUID NOT NULL REFERENCES companies(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    reference       TEXT,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
    registered_date DATE,
    expiry_date     DATE,
    notes           TEXT,
    registered_by   UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE deal_registration_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_reg_id     UUID NOT NULL REFERENCES deal_registrations(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    registered_buy_price  NUMERIC(12,2) NOT NULL,
    max_quantity    INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SALES PIPELINE
-- ============================================================================

CREATE TABLE opportunities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    company_id      UUID NOT NULL REFERENCES companies(id),
    contact_id      UUID REFERENCES contacts(id),
    assigned_to     UUID REFERENCES users(id),
    title           TEXT NOT NULL,
    stage           TEXT NOT NULL DEFAULT 'prospecting'
                    CHECK (stage IN ('prospecting', 'qualifying', 'proposal',
                                     'negotiation', 'won', 'lost')),
    estimated_value NUMERIC(12,2),
    probability     INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    expected_close_date DATE,
    lost_reason     TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- QUOTES
-- ============================================================================

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    opportunity_id  UUID REFERENCES opportunities(id),
    company_id      UUID NOT NULL REFERENCES companies(id),
    contact_id      UUID REFERENCES contacts(id),
    assigned_to     UUID REFERENCES users(id),
    quote_number    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'review', 'sent', 'accepted',
                                      'declined', 'expired', 'superseded')),
    version         INTEGER DEFAULT 1,
    parent_quote_id UUID REFERENCES quotes(id),
    quote_type      TEXT CHECK (quote_type IN ('business', 'education',
                                               'charity', 'public_sector')),
    valid_until     DATE,
    vat_rate        NUMERIC(5,2) DEFAULT 20.00,
    customer_notes  TEXT,
    internal_notes  TEXT,
    customer_po     TEXT,
    portal_token    TEXT UNIQUE,
    accepted_at     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quote_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quote_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES quote_groups(id) ON DELETE SET NULL,
    product_id      UUID REFERENCES products(id),
    supplier_id     UUID REFERENCES suppliers(id),
    deal_reg_line_id UUID REFERENCES deal_registration_lines(id),
    sort_order      INTEGER DEFAULT 0,
    description     TEXT NOT NULL,
    quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
    buy_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
    sell_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    fulfilment_route TEXT DEFAULT 'stock'
                    CHECK (fulfilment_route IN ('stock', 'deliver_to_site', 'drop_ship')),
    is_optional     BOOLEAN DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quote_attributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    attribution_type TEXT NOT NULL
                    CHECK (attribution_type IN ('direct', 'involvement', 'override')),
    split_pct       NUMERIC(5,2) NOT NULL CHECK (split_pct BETWEEN 0 AND 100),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(quote_id, user_id)
);

-- ============================================================================
-- SALES ORDERS
-- ============================================================================

CREATE TABLE sales_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    quote_id        UUID NOT NULL REFERENCES quotes(id),
    company_id      UUID NOT NULL REFERENCES companies(id),
    contact_id      UUID REFERENCES contacts(id),
    so_number       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'in_progress',
                                      'partially_fulfilled', 'fulfilled', 'cancelled')),
    customer_po     TEXT,
    delivery_address_line1 TEXT,
    delivery_address_line2 TEXT,
    delivery_city   TEXT,
    delivery_postcode TEXT,
    vat_rate        NUMERIC(5,2) DEFAULT 20.00,
    notes           TEXT,
    confirmed_at    TIMESTAMPTZ,
    fulfilled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sales_order_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id  UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    quote_line_id   UUID REFERENCES quote_lines(id),
    product_id      UUID REFERENCES products(id),
    supplier_id     UUID REFERENCES suppliers(id),
    deal_reg_line_id UUID REFERENCES deal_registration_lines(id),
    sort_order      INTEGER DEFAULT 0,
    description     TEXT NOT NULL,
    quantity        NUMERIC(10,2) NOT NULL,
    buy_price       NUMERIC(12,2) NOT NULL,
    sell_price      NUMERIC(12,2) NOT NULL,
    fulfilment_route TEXT DEFAULT 'stock'
                    CHECK (fulfilment_route IN ('stock', 'deliver_to_site', 'drop_ship')),
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'ordered', 'received',
                                      'delivered', 'cancelled')),
    serial_numbers  TEXT[],
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================
-- CRITICAL: Each PO is linked to a SPECIFIC Sales Order.
-- This is the 1:1 mapping. You do NOT order "into a pool".
-- Each PO line traces back to a specific SO line, preserving
-- the customer-specific cost (which may come from a deal registration).

CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    sales_order_id  UUID NOT NULL REFERENCES sales_orders(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    po_number       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'acknowledged',
                                      'partially_received', 'received', 'cancelled')),
    supplier_ref    TEXT,
    expected_delivery_date DATE,
    delivery_instructions TEXT,
    notes           TEXT,
    sent_at         TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_order_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id),
    product_id      UUID REFERENCES products(id),
    sort_order      INTEGER DEFAULT 0,
    description     TEXT NOT NULL,
    quantity        NUMERIC(10,2) NOT NULL,
    unit_cost       NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(10,2) DEFAULT 0,
    serial_numbers  TEXT[],
    notes           TEXT,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INVOICING
-- ============================================================================

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    sales_order_id  UUID NOT NULL REFERENCES sales_orders(id),
    company_id      UUID NOT NULL REFERENCES companies(id),
    invoice_number  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'paid', 'overdue',
                                      'void', 'credit_note')),
    subtotal        NUMERIC(12,2) NOT NULL,
    vat_amount      NUMERIC(12,2) NOT NULL,
    total           NUMERIC(12,2) NOT NULL,
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    sales_order_line_id UUID REFERENCES sales_order_lines(id),
    description     TEXT NOT NULL,
    quantity        NUMERIC(10,2) NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    unit_cost       NUMERIC(12,2) NOT NULL,
    vat_rate        NUMERIC(5,2) DEFAULT 20.00,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- COMMISSION TRACKING
-- ============================================================================
-- Calculated from INVOICED lines (actual margin, not projected).
-- Attribution splits from the quote carry through.

CREATE TABLE commission_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    user_id         UUID REFERENCES users(id),
    quote_type      TEXT,
    rate_pct        NUMERIC(5,2) NOT NULL,
    min_margin_pct  NUMERIC(5,2),
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE commission_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    invoice_id      UUID NOT NULL REFERENCES invoices(id),
    invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
    quote_id        UUID REFERENCES quotes(id),
    attribution_type TEXT NOT NULL,
    split_pct       NUMERIC(5,2) NOT NULL,
    line_revenue    NUMERIC(12,2) NOT NULL,
    line_cost       NUMERIC(12,2) NOT NULL,
    line_margin     NUMERIC(12,2) NOT NULL,
    commission_base NUMERIC(12,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,
    commission_amount NUMERIC(12,2) NOT NULL,
    period          TEXT,
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'paid')),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

CREATE TABLE activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    user_id         UUID REFERENCES users(id),
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL,
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_companies_org ON companies(org_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_products_org_sku ON products(org_id, sku);
CREATE INDEX idx_deal_regs_company ON deal_registrations(company_id);
CREATE INDEX idx_deal_regs_supplier ON deal_registrations(supplier_id);
CREATE INDEX idx_deal_regs_active ON deal_registrations(company_id, supplier_id)
    WHERE status = 'active';
CREATE INDEX idx_deal_reg_lines_product ON deal_registration_lines(deal_reg_id, product_id);
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_stage ON opportunities(org_id, stage);
CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX idx_quotes_company ON quotes(company_id);
CREATE INDEX idx_quotes_status ON quotes(org_id, status);
CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX idx_so_quote ON sales_orders(quote_id);
CREATE INDEX idx_so_lines_so ON sales_order_lines(sales_order_id);
CREATE INDEX idx_po_so ON purchase_orders(sales_order_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_lines_po ON purchase_order_lines(purchase_order_id);
CREATE INDEX idx_po_lines_so_line ON purchase_order_lines(sales_order_line_id);
CREATE INDEX idx_invoices_so ON invoices(sales_order_id);
CREATE INDEX idx_invoice_lines_so_line ON invoice_lines(sales_order_line_id);
CREATE INDEX idx_commission_user ON commission_entries(user_id, period);
CREATE INDEX idx_commission_invoice ON commission_entries(invoice_id);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Full margin traceability: quote -> SO -> PO -> invoice
CREATE VIEW v_margin_traceability AS
SELECT
    ql.id AS quote_line_id,
    q.quote_number,
    q.company_id,
    co.name AS company_name,
    sol.id AS so_line_id,
    so.so_number,
    pol.id AS po_line_id,
    po.po_number,
    il.id AS invoice_line_id,
    inv.invoice_number,
    ql.description,
    ql.quantity,
    ql.buy_price AS quoted_buy,
    ql.sell_price AS quoted_sell,
    sol.buy_price AS ordered_buy,
    sol.sell_price AS ordered_sell,
    pol.unit_cost AS actual_cost,
    il.unit_price AS invoiced_sell,
    il.unit_cost AS invoiced_cost,
    (il.unit_price - il.unit_cost) * il.quantity AS actual_margin,
    CASE WHEN il.unit_price > 0
         THEN ((il.unit_price - il.unit_cost) / il.unit_price * 100)
         ELSE 0 END AS margin_pct,
    dr.reference AS deal_reg_ref,
    dr.title AS deal_reg_title
FROM quote_lines ql
JOIN quotes q ON q.id = ql.quote_id
JOIN companies co ON co.id = q.company_id
LEFT JOIN sales_order_lines sol ON sol.quote_line_id = ql.id
LEFT JOIN sales_orders so ON so.id = sol.sales_order_id
LEFT JOIN purchase_order_lines pol ON pol.sales_order_line_id = sol.id
LEFT JOIN purchase_orders po ON po.id = pol.purchase_order_id
LEFT JOIN invoice_lines il ON il.sales_order_line_id = sol.id
LEFT JOIN invoices inv ON inv.id = il.invoice_id
LEFT JOIN deal_registration_lines drl ON drl.id = ql.deal_reg_line_id
LEFT JOIN deal_registrations dr ON dr.id = drl.deal_reg_id;

-- Commission summary by user by period
CREATE VIEW v_commission_summary AS
SELECT
    ce.user_id,
    u.first_name || ' ' || u.last_name AS user_name,
    ce.period,
    SUM(ce.line_revenue) AS total_revenue,
    SUM(ce.line_cost) AS total_cost,
    SUM(ce.line_margin) AS total_margin,
    SUM(ce.commission_amount) AS total_commission,
    COUNT(DISTINCT ce.invoice_id) AS invoice_count,
    ce.status
FROM commission_entries ce
JOIN users u ON u.id = ce.user_id
GROUP BY ce.user_id, u.first_name, u.last_name, ce.period, ce.status;

-- Active deal registrations with pricing
CREATE VIEW v_active_deal_pricing AS
SELECT
    dr.id AS deal_reg_id,
    dr.company_id,
    co.name AS company_name,
    dr.supplier_id,
    s.name AS supplier_name,
    dr.reference,
    dr.title,
    dr.expiry_date,
    drl.product_id,
    p.sku,
    p.name AS product_name,
    p.default_buy_price AS standard_cost,
    drl.registered_buy_price AS deal_cost,
    (p.default_buy_price - drl.registered_buy_price) AS saving_per_unit,
    drl.max_quantity
FROM deal_registrations dr
JOIN companies co ON co.id = dr.company_id
JOIN suppliers s ON s.id = dr.supplier_id
JOIN deal_registration_lines drl ON drl.deal_reg_id = dr.id
JOIN products p ON p.id = drl.product_id
WHERE dr.status = 'active'
  AND (dr.expiry_date IS NULL OR dr.expiry_date >= CURRENT_DATE);
