-- ============================================================================
-- ENGINEER STOCK COLLECTION MODULE
-- Tables: job_collections, job_collection_lines
-- Extends: serial_number_registry (adds 'collected' status)
-- ============================================================================

-- ============================================================================
-- 1. JOB COLLECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_collections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    job_id                  UUID NOT NULL REFERENCES jobs(id),
    sales_order_id          UUID REFERENCES sales_orders(id),
    slip_number             TEXT NOT NULL,
    slip_token              TEXT UNIQUE NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'collected', 'partial', 'cancelled')),
    prepared_by             UUID REFERENCES users(id),
    prepared_at             TIMESTAMPTZ DEFAULT now(),
    collected_by            UUID REFERENCES users(id),
    collected_at            TIMESTAMPTZ,
    collection_latitude     NUMERIC(10,7),
    collection_longitude    NUMERIC(10,7),
    collection_accuracy     NUMERIC(8,2),
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_collections_select" ON job_collections;
CREATE POLICY "job_collections_select" ON job_collections
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "job_collections_insert" ON job_collections;
CREATE POLICY "job_collections_insert" ON job_collections
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "job_collections_update" ON job_collections;
CREATE POLICY "job_collections_update" ON job_collections
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "job_collections_delete" ON job_collections;
CREATE POLICY "job_collections_delete" ON job_collections
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================================
-- 2. JOB COLLECTION LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_collection_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id           UUID NOT NULL REFERENCES job_collections(id) ON DELETE CASCADE,
    sales_order_line_id     UUID REFERENCES sales_order_lines(id),
    product_id              UUID NOT NULL REFERENCES products(id),
    description             TEXT NOT NULL,
    quantity_expected       NUMERIC(10,2) NOT NULL,
    quantity_confirmed      NUMERIC(10,2) DEFAULT 0,
    expected_serials        TEXT[],
    confirmed_serials       TEXT[],
    is_confirmed            BOOLEAN DEFAULT false,
    confirmed_at            TIMESTAMPTZ,
    notes                   TEXT,
    sort_order              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_collection_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_collection_lines_select" ON job_collection_lines;
CREATE POLICY "job_collection_lines_select" ON job_collection_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM job_collections jc
            WHERE jc.id = job_collection_lines.collection_id
            AND jc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "job_collection_lines_insert" ON job_collection_lines;
CREATE POLICY "job_collection_lines_insert" ON job_collection_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM job_collections jc
            WHERE jc.id = job_collection_lines.collection_id
            AND jc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "job_collection_lines_update" ON job_collection_lines;
CREATE POLICY "job_collection_lines_update" ON job_collection_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM job_collections jc
            WHERE jc.id = job_collection_lines.collection_id
            AND jc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "job_collection_lines_delete" ON job_collection_lines;
CREATE POLICY "job_collection_lines_delete" ON job_collection_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM job_collections jc
            WHERE jc.id = job_collection_lines.collection_id
            AND jc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

-- ============================================================================
-- 3. SERIAL NUMBER REGISTRY — add 'collected' status
-- ============================================================================

ALTER TABLE serial_number_registry
    DROP CONSTRAINT IF EXISTS serial_number_registry_status_check;

ALTER TABLE serial_number_registry
    ADD CONSTRAINT serial_number_registry_status_check
    CHECK (status IN ('in_stock', 'allocated', 'collected', 'dispatched', 'returned'));

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_collections_job ON job_collections(job_id);
CREATE INDEX IF NOT EXISTS idx_job_collections_token ON job_collections(slip_token);
CREATE INDEX IF NOT EXISTS idx_job_collections_status ON job_collections(org_id, status);
CREATE INDEX IF NOT EXISTS idx_job_collection_lines_collection ON job_collection_lines(collection_id);

-- ============================================================================
-- 5. PERMISSIONS
-- ============================================================================

INSERT INTO permissions (module, action, description) VALUES
    ('collections', 'view', 'View stock collections'),
    ('collections', 'create', 'Create stock collections'),
    ('collections', 'edit', 'Edit stock collections'),
    ('collections', 'confirm', 'Confirm stock collections')
ON CONFLICT (module, action) DO NOTHING;

-- super_admin / admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'collections'
ON CONFLICT DO NOTHING;

-- purchasing: view + create + edit (prepares collections, cannot confirm)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module = 'collections'
AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- engineering: view + confirm (confirms collection on pickup)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'collections'
AND p.action IN ('view', 'confirm')
ON CONFLICT DO NOTHING;

-- field_engineer: view + confirm
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'field_engineer'
AND p.module = 'collections'
AND p.action IN ('view', 'confirm')
ON CONFLICT DO NOTHING;

-- sales: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'collections'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- accounts: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module = 'collections'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
