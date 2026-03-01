-- ============================================================================
-- Products, Suppliers & Categories - Schema Enhancements
-- Migration: 20260301000000_products_suppliers_enhancements
-- ============================================================================

-- 1. Add requires_serial to product_categories
ALTER TABLE product_categories
ADD COLUMN requires_serial BOOLEAN DEFAULT false;

-- 2. Make is_serialised nullable (tri-state: null = inherit from category)
ALTER TABLE products
ALTER COLUMN is_serialised DROP DEFAULT,
ALTER COLUMN is_serialised DROP NOT NULL;

COMMENT ON COLUMN products.is_serialised IS
'NULL = inherit from category requires_serial. true = always serialised. false = never serialised.';

-- 3. Create supplier_integrations table
CREATE TABLE supplier_integrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    integration_type    TEXT NOT NULL DEFAULT 'manual'
                        CHECK (integration_type IN ('manual', 'api', 'csv_import')),
    api_base_url        TEXT,
    auth_config         JSONB DEFAULT '{}',
    capabilities        JSONB DEFAULT '[]',
    mapping_config      JSONB DEFAULT '{}',
    is_active           BOOLEAN DEFAULT false,
    last_sync_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(supplier_id)
);

CREATE INDEX idx_supplier_integrations_supplier ON supplier_integrations(supplier_id);

-- ============================================================================
-- 4. Row-Level Security Policies
-- Pattern: org_id resolved via users.auth_id = auth.uid()
-- ============================================================================

-- product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org categories"
ON product_categories FOR SELECT
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can insert categories"
ON product_categories FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can update categories"
ON product_categories FOR UPDATE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can delete categories"
ON product_categories FOR DELETE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org products"
ON products FOR SELECT
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can insert products"
ON products FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can update products"
ON products FOR UPDATE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can delete products"
ON products FOR DELETE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org suppliers"
ON suppliers FOR SELECT
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can insert suppliers"
ON suppliers FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can update suppliers"
ON suppliers FOR UPDATE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can delete suppliers"
ON suppliers FOR DELETE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- product_suppliers (org scoped via products table)
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product suppliers"
ON product_suppliers FOR SELECT
USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id
            AND p.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY "Admins can insert product suppliers"
ON product_suppliers FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id
            AND p.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY "Admins can update product suppliers"
ON product_suppliers FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id
            AND p.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY "Admins can delete product suppliers"
ON product_suppliers FOR DELETE
USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id
            AND p.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

-- supplier_integrations
ALTER TABLE supplier_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org integrations"
ON supplier_integrations FOR SELECT
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can insert integrations"
ON supplier_integrations FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can update integrations"
ON supplier_integrations FOR UPDATE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can delete integrations"
ON supplier_integrations FOR DELETE
USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
