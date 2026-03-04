-- Contract Visit Slots
-- Recurring visit patterns (engineer, day, cycle weeks, time) on customer contracts.
-- The Visit Scheduling module reads these slots to generate diary entries.

-- ============================================================
-- field_engineer role (for dedicated field staff)
-- ============================================================
INSERT INTO roles (org_id, name, display_name)
SELECT org_id, 'field_engineer', 'Field Engineer'
FROM roles WHERE name = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Grant field_engineer basic permissions (same view-level access as engineering, plus scheduling)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'field_engineer'
  AND (
    (p.module = 'contracts' AND p.action = 'view')
    OR (p.module = 'scheduling' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'customers' AND p.action = 'view')
    OR (p.module = 'products' AND p.action = 'view')
    OR (p.module = 'helpdesk' AND p.action IN ('view', 'create', 'edit'))
  )
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ============================================================
-- contract_visit_slots — recurring visit schedule per contract
-- ============================================================
CREATE TABLE contract_visit_slots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_contract_id    UUID NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
    engineer_id             UUID NOT NULL REFERENCES users(id),
    cycle_week_numbers      INTEGER[] NOT NULL,
    day_of_week             TEXT NOT NULL CHECK (day_of_week IN
                            ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
    time_slot               TEXT NOT NULL DEFAULT 'am'
                            CHECK (time_slot IN ('am', 'pm', 'custom')),
    default_start_time      TIME NOT NULL DEFAULT '08:30',
    default_end_time        TIME NOT NULL DEFAULT '12:00',
    override_start_time     TIME,
    override_end_time       TIME,
    notes                   TEXT,
    sort_order              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contract_visit_slots_contract ON contract_visit_slots(customer_contract_id);
CREATE INDEX idx_contract_visit_slots_engineer ON contract_visit_slots(engineer_id);

-- ============================================================
-- RLS — scoped via parent customer_contracts org_id
-- ============================================================
ALTER TABLE contract_visit_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_visit_slots_select" ON contract_visit_slots FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM customer_contracts cc
        WHERE cc.id = contract_visit_slots.customer_contract_id
          AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
    ));

CREATE POLICY "contract_visit_slots_insert" ON contract_visit_slots FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_visit_slots.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales', 'engineering')
            )
        )
    );

CREATE POLICY "contract_visit_slots_update" ON contract_visit_slots FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_visit_slots.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'sales', 'engineering')
            )
        )
    );

CREATE POLICY "contract_visit_slots_delete" ON contract_visit_slots FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM customer_contracts cc
            WHERE cc.id = contract_visit_slots.customer_contract_id
            AND cc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
            )
        )
    );

-- ============================================================
-- View — visit slots with effective times and joined details
-- ============================================================
CREATE OR REPLACE VIEW v_contract_visit_slots AS
SELECT
    cvs.id,
    cvs.customer_contract_id,
    cc.contract_number,
    cc.customer_id,
    cu.name AS customer_name,
    ct.name AS contract_type_name,
    ct.code AS contract_type_code,
    cvs.engineer_id,
    u.first_name || ' ' || u.last_name AS engineer_name,
    cvs.cycle_week_numbers,
    cvs.day_of_week,
    cvs.time_slot,
    COALESCE(cvs.override_start_time, cvs.default_start_time) AS effective_start_time,
    COALESCE(cvs.override_end_time, cvs.default_end_time) AS effective_end_time,
    cvs.notes,
    cvs.sort_order
FROM contract_visit_slots cvs
JOIN customer_contracts cc ON cc.id = cvs.customer_contract_id
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
JOIN users u ON u.id = cvs.engineer_id
WHERE cc.status = 'active';
