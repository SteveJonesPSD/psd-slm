-- E-Sign Module — Core Infrastructure
-- Contract e-signing requests, renewal flagging, and extended contract statuses.

-- ============================================================
-- contract_esign_requests — tracks every signing request
-- ============================================================
CREATE TABLE contract_esign_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                UUID NOT NULL REFERENCES organisations(id),
    contract_id           UUID NOT NULL REFERENCES customer_contracts(id),
    request_type          TEXT NOT NULL CHECK (request_type IN (
                            'new_contract',
                            'renewal_acceptance',
                            'schedule_acceptance'
                          )),
    status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'signed', 'declined', 'expired'
                          )),
    token                 UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    document_path         TEXT,
    signed_document_path  TEXT,
    signature_path        TEXT,
    signer_name           TEXT,
    signer_email          TEXT,
    signed_at             TIMESTAMPTZ,
    declined_at           TIMESTAMPTZ,
    decline_notes         TEXT,
    ip_address            TEXT,
    expires_at            TIMESTAMPTZ NOT NULL,
    sent_at               TIMESTAMPTZ,
    sent_by               UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_esign_requests_contract ON contract_esign_requests(contract_id);
CREATE INDEX idx_esign_requests_token ON contract_esign_requests(token);
CREATE INDEX idx_esign_requests_status ON contract_esign_requests(status);

-- ============================================================
-- contract_renewal_flags — tracks renewal due / overdue flags
-- ============================================================
CREATE TABLE contract_renewal_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    contract_id     UUID NOT NULL REFERENCES customer_contracts(id),
    flag_type       TEXT NOT NULL DEFAULT 'renewal_due' CHECK (flag_type IN (
                      'renewal_due', 'renewal_overdue'
                    )),
    days_remaining  INT NOT NULL,
    flagged_at      TIMESTAMPTZ DEFAULT now(),
    actioned_at     TIMESTAMPTZ,
    actioned_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_renewal_flags_contract ON contract_renewal_flags(contract_id);
CREATE INDEX idx_renewal_flags_actioned ON contract_renewal_flags(actioned_at)
    WHERE actioned_at IS NULL;

-- ============================================================
-- Alter customer_contracts — extend status enum + new fields
-- ============================================================

-- Drop the existing CHECK constraint on status and replace with extended enum.
-- The original constraint name may vary; use a safe DO block.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find and drop all CHECK constraints on customer_contracts.status
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'customer_contracts'
          AND att.attname = 'status'
          AND con.contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE customer_contracts DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Add the extended status CHECK constraint
ALTER TABLE customer_contracts
    ADD CONSTRAINT customer_contracts_status_check CHECK (status IN (
        'draft',
        'pending_signature',
        'declined_signature',
        'awaiting_activation',
        'active',
        'renewal_flagged',
        'renewal_sent',
        'renewal_accepted',
        'schedule_pending',
        'not_renewing',
        'expired',
        'cancelled',
        'renewed'
    ));

-- Add new columns
ALTER TABLE customer_contracts
    ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS renewal_notice_days INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS esign_required BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_customer_contracts_account_manager
    ON customer_contracts(account_manager_id);

-- Add requires_visit_slots to contract_types (gates "Send for Signing" on visit-based types)
ALTER TABLE contract_types
    ADD COLUMN IF NOT EXISTS requires_visit_slots BOOLEAN DEFAULT false;

-- Set requires_visit_slots = true for ProFlex/SchoolCare types that have visit frequency
UPDATE contract_types
SET requires_visit_slots = true
WHERE default_visit_frequency IS NOT NULL;

-- ============================================================
-- Seed e-sign org_settings defaults
-- ============================================================
-- These use a CTE to find the org_id from the organisations table.
-- Only inserts if the key doesn't already exist (unique on org_id, setting_key).
INSERT INTO org_settings (org_id, category, setting_key, setting_value, description)
SELECT o.id, 'esign', 'default_renewal_notice_days', '"60"'::jsonb, 'Days before contract end to flag for renewal'
FROM organisations o
WHERE NOT EXISTS (
    SELECT 1 FROM org_settings os
    WHERE os.org_id = o.id AND os.setting_key = 'default_renewal_notice_days'
)
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value, description)
SELECT o.id, 'esign', 'esign_from_name', '"Contracts Team"'::jsonb, 'Display name for e-sign outbound emails'
FROM organisations o
WHERE NOT EXISTS (
    SELECT 1 FROM org_settings os
    WHERE os.org_id = o.id AND os.setting_key = 'esign_from_name'
)
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value, description)
SELECT o.id, 'esign', 'esign_expiry_days', '"30"'::jsonb, 'Days before e-sign links expire'
FROM organisations o
WHERE NOT EXISTS (
    SELECT 1 FROM org_settings os
    WHERE os.org_id = o.id AND os.setting_key = 'esign_expiry_days'
)
ON CONFLICT (org_id, setting_key) DO NOTHING;

-- ============================================================
-- RLS Policies — contract_esign_requests
-- ============================================================
ALTER TABLE contract_esign_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esign_requests_select" ON contract_esign_requests FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "esign_requests_insert" ON contract_esign_requests FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
        )
    );

CREATE POLICY "esign_requests_update" ON contract_esign_requests FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales')
        )
    );

CREATE POLICY "esign_requests_delete" ON contract_esign_requests FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — contract_renewal_flags
-- ============================================================
ALTER TABLE contract_renewal_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "renewal_flags_select" ON contract_renewal_flags FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "renewal_flags_insert" ON contract_renewal_flags FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "renewal_flags_update" ON contract_renewal_flags FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- Storage bucket for e-sign documents
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'esign-documents',
    'esign-documents',
    false,
    52428800,  -- 50MB
    ARRAY['application/pdf', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users in same org can read
CREATE POLICY "esign_docs_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'esign-documents');

CREATE POLICY "esign_docs_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'esign-documents');

CREATE POLICY "esign_docs_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'esign-documents');

CREATE POLICY "esign_docs_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'esign-documents');

-- ============================================================
-- Update active contracts view to include new fields
-- ============================================================
DROP VIEW IF EXISTS v_customer_contracts_active;

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
    cc.signed_by_name,
    cc.account_manager_id,
    cc.renewal_notice_days,
    cc.esign_required
FROM customer_contracts cc
JOIN contract_types ct ON ct.id = cc.contract_type_id
JOIN customers co ON co.id = cc.customer_id
WHERE cc.status = 'active';
