-- Invoicing Module
-- Adds invoice-specific columns, RLS policies, permissions, and indexes
-- Supports full and partial invoicing from sales orders

-- ============================================================
-- Alter invoices table — add new columns
-- ============================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (invoice_type IN ('standard', 'proforma', 'credit_note'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES invoices(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_po TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_status TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_last_synced TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 20.00;

-- ============================================================
-- Alter invoice_lines table — add new columns
-- ============================================================
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS group_name TEXT;

-- ============================================================
-- Alter sales_order_lines — partial invoicing tracking
-- ============================================================
ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS quantity_invoiced NUMERIC(10,2) DEFAULT 0;

-- ============================================================
-- Add invoice_prefix to brands table
-- ============================================================
ALTER TABLE brands ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_brand ON invoices(brand_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_parent ON invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_lines_product ON invoice_lines(product_id);

-- ============================================================
-- RLS Policies — invoices
-- ============================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (from original schema)
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

-- SELECT: all org users
CREATE POLICY "invoices_select" ON invoices FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- INSERT: admin, accounts, sales
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accounts', 'sales')
        )
    );

-- UPDATE: admin, accounts
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accounts')
        )
    );

-- DELETE: admin only
CREATE POLICY "invoices_delete" ON invoices FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — invoice_lines (follows parent invoice)
-- ============================================================
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (from original schema)
DROP POLICY IF EXISTS "invoice_lines_select" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_insert" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_update" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_delete" ON invoice_lines;

-- SELECT: org scope via parent invoice
CREATE POLICY "invoice_lines_select" ON invoice_lines FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id
                AND i.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
    );

-- INSERT: admin, accounts, sales
CREATE POLICY "invoice_lines_insert" ON invoice_lines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id
            AND i.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accounts', 'sales')
            )
        )
    );

-- UPDATE: admin, accounts
CREATE POLICY "invoice_lines_update" ON invoice_lines FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id
            AND i.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accounts')
            )
        )
    );

-- DELETE: admin only
CREATE POLICY "invoice_lines_delete" ON invoice_lines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id
            AND i.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
            )
        )
    );

-- ============================================================
-- Permissions
-- ============================================================
INSERT INTO permissions (module, action, description) VALUES
    ('invoices', 'view', 'View invoices'),
    ('invoices', 'create', 'Create invoices'),
    ('invoices', 'edit', 'Edit invoices'),
    ('invoices', 'delete', 'Delete invoices')
ON CONFLICT (module, action) DO NOTHING;

-- admin / super_admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'invoices'
ON CONFLICT DO NOTHING;

-- accounts: full access (primary invoicing users)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module = 'invoices'
ON CONFLICT DO NOTHING;

-- sales: view + create (can see invoices and create from their SOs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'invoices'
AND p.action IN ('view', 'create')
ON CONFLICT DO NOTHING;

-- purchasing: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module = 'invoices'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- engineering: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'invoices'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
