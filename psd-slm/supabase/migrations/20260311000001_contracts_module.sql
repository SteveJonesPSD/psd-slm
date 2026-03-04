-- Contracts Module
-- Service agreements between PSD Group and its customers.
-- Bridges commercial (sales/renewals) and operational (scheduling/support) chains.

-- ============================================================
-- contract_types — master templates for service tiers
-- ============================================================
CREATE TABLE contract_types (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES organisations(id),
    name                        TEXT NOT NULL,
    code                        TEXT NOT NULL,
    description                 TEXT,
    category                    TEXT NOT NULL DEFAULT 'ict'
                                CHECK (category IN ('ict', 'access_control', 'cctv',
                                                    'telephony', 'maintenance', 'bespoke')),
    default_visit_frequency     TEXT CHECK (default_visit_frequency IN
                                ('daily', 'weekly', 'fortnightly', 'monthly')),
    default_visit_length_hours  NUMERIC(4,1),
    default_visits_per_year     INTEGER,
    includes_remote_support     BOOLEAN DEFAULT false,
    includes_telephone          BOOLEAN DEFAULT false,
    includes_onsite             BOOLEAN DEFAULT false,
    is_active                   BOOLEAN DEFAULT true,
    sort_order                  INTEGER DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, code)
);

-- ============================================================
-- customer_contracts — actual contracts assigned to customers
-- ============================================================
CREATE TABLE customer_contracts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),
    contract_type_id        UUID NOT NULL REFERENCES contract_types(id),
    contact_id              UUID REFERENCES contacts(id),
    contract_number         TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'pending_signature', 'active',
                                              'expired', 'cancelled', 'renewed')),
    parent_contract_id      UUID REFERENCES customer_contracts(id),
    version                 INTEGER DEFAULT 1,
    visit_frequency         TEXT CHECK (visit_frequency IN
                            ('daily', 'weekly', 'fortnightly', 'monthly')),
    visit_length_hours      NUMERIC(4,1),
    visits_per_year         INTEGER,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    renewal_period          TEXT NOT NULL DEFAULT 'april'
                            CHECK (renewal_period IN ('april', 'september', 'custom')),
    renewal_month           INTEGER CHECK (renewal_month BETWEEN 1 AND 12),
    auto_renew              BOOLEAN DEFAULT true,
    annual_value            NUMERIC(12,2),
    billing_frequency       TEXT DEFAULT 'annually'
                            CHECK (billing_frequency IN ('monthly', 'quarterly', 'annually')),
    opportunity_id          UUID REFERENCES opportunities(id),
    quote_id                UUID REFERENCES quotes(id),
    esign_request_id        UUID,
    last_signed_at          TIMESTAMPTZ,
    signed_by_name          TEXT,
    notes                   TEXT,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- contract_lines — informational line items (assets covered)
-- ============================================================
CREATE TABLE contract_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_contract_id    UUID NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
    description             TEXT NOT NULL,
    unit_type               TEXT,
    quantity                NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price_annual       NUMERIC(12,2),
    location                TEXT,
    product_id              UUID REFERENCES products(id),
    sort_order              INTEGER DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- contract_renewals — audit trail for every renewal event
-- ============================================================
CREATE TABLE contract_renewals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_contract_id         UUID NOT NULL REFERENCES customer_contracts(id),
    new_contract_id         UUID NOT NULL REFERENCES customer_contracts(id),
    previous_end_date       DATE NOT NULL,
    new_start_date          DATE NOT NULL,
    new_end_date            DATE NOT NULL,
    previous_annual_value   NUMERIC(12,2),
    new_annual_value        NUMERIC(12,2),
    renewal_method          TEXT NOT NULL CHECK (renewal_method IN
                            ('auto', 'manual', 'esign', 'bulk')),
    esign_request_id        UUID,
    notes                   TEXT,
    renewed_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- contract_entitlements — per-customer entitlement additions/removals
-- ============================================================
CREATE TABLE contract_entitlements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_contract_id    UUID NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
    entitlement_type        TEXT NOT NULL,
    description             TEXT,
    is_included             BOOLEAN DEFAULT true,
    sort_order              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_contract_types_org ON contract_types(org_id);
CREATE INDEX idx_customer_contracts_customer ON customer_contracts(customer_id);
CREATE INDEX idx_customer_contracts_type ON customer_contracts(contract_type_id);
CREATE INDEX idx_customer_contracts_status ON customer_contracts(org_id, status);
CREATE INDEX idx_customer_contracts_renewal ON customer_contracts(renewal_period, end_date)
    WHERE status = 'active';
CREATE INDEX idx_customer_contracts_parent ON customer_contracts(parent_contract_id);
CREATE INDEX idx_contract_lines_contract ON contract_lines(customer_contract_id);
CREATE INDEX idx_contract_renewals_old ON contract_renewals(old_contract_id);
CREATE INDEX idx_contract_renewals_new ON contract_renewals(new_contract_id);
CREATE INDEX idx_contract_entitlements_contract ON contract_entitlements(customer_contract_id);

-- ============================================================
-- Views
-- ============================================================
CREATE VIEW v_customer_contracts_active AS
SELECT
    cc.id,
    cc.contract_number,
    cc.version,
    cc.customer_id,
    co.name AS customer_name,
    cc.contract_type_id,
    ct.name AS contract_type_name,
    ct.code AS contract_type_code,
    ct.category,
    COALESCE(cc.visit_frequency, ct.default_visit_frequency) AS effective_frequency,
    COALESCE(cc.visits_per_year, ct.default_visits_per_year) AS effective_visits_per_year,
    COALESCE(cc.visit_length_hours, ct.default_visit_length_hours) AS effective_visit_hours,
    ct.includes_remote_support,
    ct.includes_telephone,
    ct.includes_onsite,
    cc.start_date,
    cc.end_date,
    cc.renewal_period,
    cc.renewal_month,
    cc.auto_renew,
    cc.annual_value,
    cc.billing_frequency,
    cc.status,
    cc.last_signed_at,
    cc.signed_by_name
FROM customer_contracts cc
JOIN contract_types ct ON ct.id = cc.contract_type_id
JOIN customers co ON co.id = cc.customer_id
WHERE cc.status = 'active';

CREATE VIEW v_contracts_due_renewal AS
SELECT
    cc.id,
    cc.contract_number,
    co.name AS customer_name,
    ct.name AS contract_type_name,
    ct.category,
    cc.end_date,
    cc.renewal_period,
    cc.auto_renew,
    cc.annual_value,
    (cc.end_date - CURRENT_DATE) AS days_until_expiry
FROM customer_contracts cc
JOIN contract_types ct ON ct.id = cc.contract_type_id
JOIN customers co ON co.id = cc.customer_id
WHERE cc.status = 'active'
  AND cc.end_date <= (CURRENT_DATE + INTERVAL '90 days')
ORDER BY cc.end_date ASC;

CREATE VIEW v_contract_history AS
SELECT
    cr.id AS renewal_id,
    cr.old_contract_id,
    cr.new_contract_id,
    co.name AS customer_name,
    ct.name AS contract_type_name,
    cr.previous_end_date,
    cr.new_start_date,
    cr.new_end_date,
    cr.previous_annual_value,
    cr.new_annual_value,
    cr.renewal_method,
    cr.created_at AS renewed_at,
    u.first_name || ' ' || u.last_name AS renewed_by_name
FROM contract_renewals cr
JOIN customer_contracts cc ON cc.id = cr.new_contract_id
JOIN customers co ON co.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
LEFT JOIN users u ON u.id = cr.renewed_by
ORDER BY cr.created_at DESC;

-- ============================================================
-- RLS Policies — contract_types
-- ============================================================
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_types_select" ON contract_types FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "contract_types_insert" ON contract_types FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "contract_types_update" ON contract_types FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "contract_types_delete" ON contract_types FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — customer_contracts
-- ============================================================
ALTER TABLE customer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_contracts_select" ON customer_contracts FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "customer_contracts_insert" ON customer_contracts FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
        )
    );

CREATE POLICY "customer_contracts_update" ON customer_contracts FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
        )
    );

CREATE POLICY "customer_contracts_delete" ON customer_contracts FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — contract_lines (follows parent contract)
-- ============================================================
ALTER TABLE contract_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_lines_select" ON contract_lines FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM customer_contracts cc
                WHERE cc.id = contract_lines.customer_contract_id
                AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
    );

CREATE POLICY "contract_lines_insert" ON contract_lines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_lines.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
            )
        )
    );

CREATE POLICY "contract_lines_update" ON contract_lines FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_lines.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
            )
        )
    );

CREATE POLICY "contract_lines_delete" ON contract_lines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_lines.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
            )
        )
    );

-- ============================================================
-- RLS Policies — contract_entitlements (follows parent contract)
-- ============================================================
ALTER TABLE contract_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_entitlements_select" ON contract_entitlements FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM customer_contracts cc
                WHERE cc.id = contract_entitlements.customer_contract_id
                AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
    );

CREATE POLICY "contract_entitlements_insert" ON contract_entitlements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_entitlements.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
            )
        )
    );

CREATE POLICY "contract_entitlements_update" ON contract_entitlements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_entitlements.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
            )
        )
    );

CREATE POLICY "contract_entitlements_delete" ON contract_entitlements FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_entitlements.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
            )
        )
    );

-- ============================================================
-- RLS Policies — contract_renewals (follows parent contract)
-- ============================================================
ALTER TABLE contract_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_renewals_select" ON contract_renewals FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM customer_contracts cc
                WHERE cc.id = contract_renewals.new_contract_id
                AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
    );

CREATE POLICY "contract_renewals_insert" ON contract_renewals FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_renewals.new_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
            )
        )
    );

-- ============================================================
-- Permissions
-- ============================================================
INSERT INTO permissions (module, action, description) VALUES
    ('contracts', 'view', 'View contracts'),
    ('contracts', 'create', 'Create contracts'),
    ('contracts', 'edit', 'Edit contracts'),
    ('contracts', 'delete', 'Delete contracts')
ON CONFLICT (module, action) DO NOTHING;

-- admin / super_admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'contracts'
ON CONFLICT DO NOTHING;

-- sales: view + create + edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'contracts'
AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- accounts: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module = 'contracts'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- purchasing: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module = 'contracts'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- engineering: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'contracts'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
