-- Settings & Brands module
-- Organisation settings (key-value store for config) and Brands (trading identities)

-- ============================================================
-- org_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS org_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    category        TEXT NOT NULL,
    setting_key     TEXT NOT NULL,
    setting_value   JSONB,
    is_secret       BOOLEAN DEFAULT false,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_org_settings_key ON org_settings(org_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_org_settings_category ON org_settings(org_id, category);

-- ============================================================
-- brands table
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    name            TEXT NOT NULL,
    is_default      BOOLEAN DEFAULT false,
    legal_entity    TEXT,
    company_reg_number TEXT,
    vat_number      TEXT,
    address_line1   TEXT,
    address_line2   TEXT,
    city            TEXT,
    county          TEXT,
    postcode        TEXT,
    country         TEXT DEFAULT 'GB',
    phone           TEXT,
    fax             TEXT,
    email           TEXT,
    website         TEXT,
    logo_path       TEXT,
    logo_width      INTEGER DEFAULT 200,
    footer_text     TEXT,
    registered_address TEXT,
    default_terms   TEXT,
    default_payment_terms_text TEXT,
    quote_prefix    TEXT DEFAULT 'Q',
    is_active       BOOLEAN DEFAULT true,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_org ON brands(org_id);

-- ============================================================
-- Add brand_id to quotes
-- ============================================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- ============================================================
-- Storage bucket for brand logos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS Policies — org_settings
-- ============================================================
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users in the org
CREATE POLICY "org_settings_select" ON org_settings FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid())
        OR org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- INSERT: admin only
CREATE POLICY "org_settings_insert" ON org_settings FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- UPDATE: admin only
CREATE POLICY "org_settings_update" ON org_settings FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- DELETE: admin only
CREATE POLICY "org_settings_delete" ON org_settings FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — brands
-- ============================================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users in the org
CREATE POLICY "brands_select" ON brands FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid())
        OR org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- INSERT: admin only
CREATE POLICY "brands_insert" ON brands FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- UPDATE: admin only
CREATE POLICY "brands_update" ON brands FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- DELETE: admin only
CREATE POLICY "brands_delete" ON brands FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- Storage policies for brand-assets bucket
-- ============================================================
CREATE POLICY "brand_assets_public_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_admin_write" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'brand-assets'
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "brand_assets_admin_update" ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'brand-assets'
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "brand_assets_admin_delete" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'brand-assets'
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );
