-- Visit Scheduling Module
-- Recurring visit calendar for SchoolCare (education brand).
-- Schools get ICT support visits on a 4-week rolling cycle aligned to the academic year.
-- Depends on: customers, customer_contracts, users, organisations

-- ============================================================
-- Drop old schema if re-running (schema was rewritten)
-- ============================================================
DROP VIEW IF EXISTS v_slot_templates_overview CASCADE;
DROP VIEW IF EXISTS v_engineer_schedule CASCADE;
DROP TABLE IF EXISTS visit_instances CASCADE;
DROP TABLE IF EXISTS visit_slot_templates CASCADE;
DROP TABLE IF EXISTS visit_calendar_weeks CASCADE;
DROP TABLE IF EXISTS visit_calendars CASCADE;
DROP TABLE IF EXISTS bank_holidays CASCADE;
DROP TABLE IF EXISTS visit_settings CASCADE;

-- ============================================================
-- visit_settings — AM/PM default times per org
-- ============================================================
CREATE TABLE visit_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    am_default_start    TIME NOT NULL DEFAULT '08:30',
    am_default_end      TIME NOT NULL DEFAULT '12:00',
    pm_default_start    TIME NOT NULL DEFAULT '12:30',
    pm_default_end      TIME NOT NULL DEFAULT '16:00',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id)
);

-- ============================================================
-- bank_holidays — England bank holidays reference
-- ============================================================
CREATE TABLE bank_holidays (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    holiday_date    DATE NOT NULL,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, holiday_date)
);

-- ============================================================
-- visit_calendars — one per academic year (draft/active/archived)
-- ============================================================
CREATE TABLE visit_calendars (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    name                TEXT NOT NULL,
    academic_year_start DATE NOT NULL,
    academic_year_end   DATE NOT NULL,
    schedule_weeks      INTEGER NOT NULL DEFAULT 39
                        CHECK (schedule_weeks IN (36, 39)),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'archived')),
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- visit_calendar_weeks — generated weeks (Mon–Fri), holiday
-- flags, cycle numbers
-- ============================================================
CREATE TABLE visit_calendar_weeks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id         UUID NOT NULL REFERENCES visit_calendars(id) ON DELETE CASCADE,
    week_start_date     DATE NOT NULL,
    cycle_week_number   INTEGER CHECK (cycle_week_number BETWEEN 1 AND 4),
    is_holiday          BOOLEAN NOT NULL DEFAULT false,
    holiday_name        TEXT,
    sort_order          INTEGER NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(calendar_id, sort_order)
);

-- ============================================================
-- visit_slot_templates — recurring patterns
-- (customer + contract + engineer + day + cycle weeks)
-- ============================================================
CREATE TABLE visit_slot_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    calendar_id             UUID NOT NULL REFERENCES visit_calendars(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),
    customer_contract_id    UUID NOT NULL REFERENCES customer_contracts(id),
    engineer_id             UUID NOT NULL REFERENCES users(id),
    day_of_week             TEXT NOT NULL
                            CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
    time_slot               TEXT NOT NULL DEFAULT 'am'
                            CHECK (time_slot IN ('am', 'pm', 'custom')),
    cycle_weeks             INTEGER[] NOT NULL DEFAULT '{1,2,3,4}',
    default_start_time      TIME,
    default_end_time        TIME,
    override_start_time     TIME,
    override_end_time       TIME,
    notes                   TEXT,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'ended')),
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- visit_instances — generated diary entries with status workflow
-- ============================================================
CREATE TABLE visit_instances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    slot_template_id        UUID REFERENCES visit_slot_templates(id) ON DELETE SET NULL,
    calendar_id             UUID NOT NULL REFERENCES visit_calendars(id),
    calendar_week_id        UUID REFERENCES visit_calendar_weeks(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),
    customer_contract_id    UUID REFERENCES customer_contracts(id),
    engineer_id             UUID NOT NULL REFERENCES users(id),
    visit_date              DATE NOT NULL,
    time_slot               TEXT NOT NULL DEFAULT 'am'
                            CHECK (time_slot IN ('am', 'pm', 'custom')),
    start_time              TIME,
    end_time                TIME,
    cycle_week_number       INTEGER,
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'confirmed', 'completed',
                                              'cancelled', 'rescheduled', 'bank_holiday_pending')),
    is_bank_holiday         BOOLEAN NOT NULL DEFAULT false,
    confirmed_at            TIMESTAMPTZ,
    confirmed_by            UUID REFERENCES users(id),
    completed_at            TIMESTAMPTZ,
    completed_by            UUID REFERENCES users(id),
    cancellation_reason     TEXT,
    rescheduled_to_date     DATE,
    completion_notes        TEXT,
    notes                   TEXT,
    generated_at            TIMESTAMPTZ DEFAULT now(),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_visit_settings_org ON visit_settings(org_id);
CREATE INDEX idx_bank_holidays_org ON bank_holidays(org_id);
CREATE INDEX idx_bank_holidays_date ON bank_holidays(org_id, holiday_date);

CREATE INDEX idx_visit_calendars_org ON visit_calendars(org_id);
CREATE INDEX idx_visit_calendars_status ON visit_calendars(org_id, status);
CREATE INDEX idx_visit_calendar_weeks_calendar ON visit_calendar_weeks(calendar_id);
CREATE INDEX idx_visit_calendar_weeks_date ON visit_calendar_weeks(week_start_date);

CREATE INDEX idx_visit_slot_templates_org ON visit_slot_templates(org_id);
CREATE INDEX idx_visit_slot_templates_calendar ON visit_slot_templates(calendar_id);
CREATE INDEX idx_visit_slot_templates_customer ON visit_slot_templates(customer_id);
CREATE INDEX idx_visit_slot_templates_contract ON visit_slot_templates(customer_contract_id);
CREATE INDEX idx_visit_slot_templates_engineer ON visit_slot_templates(engineer_id);
CREATE INDEX idx_visit_slot_templates_active ON visit_slot_templates(org_id, status)
    WHERE status = 'active';

CREATE INDEX idx_visit_instances_org ON visit_instances(org_id);
CREATE INDEX idx_visit_instances_calendar ON visit_instances(calendar_id);
CREATE INDEX idx_visit_instances_customer ON visit_instances(customer_id);
CREATE INDEX idx_visit_instances_contract ON visit_instances(customer_contract_id);
CREATE INDEX idx_visit_instances_engineer ON visit_instances(engineer_id);
CREATE INDEX idx_visit_instances_date ON visit_instances(visit_date);
CREATE INDEX idx_visit_instances_status ON visit_instances(org_id, status);
CREATE INDEX idx_visit_instances_engineer_date ON visit_instances(engineer_id, visit_date);
CREATE INDEX idx_visit_instances_template ON visit_instances(slot_template_id);

-- ============================================================
-- Views
-- ============================================================
CREATE VIEW v_engineer_schedule AS
SELECT
    vi.id,
    vi.visit_date,
    vi.time_slot,
    vi.start_time,
    vi.end_time,
    vi.status,
    vi.cycle_week_number,
    vi.engineer_id,
    u.first_name || ' ' || u.last_name AS engineer_name,
    u.color AS engineer_color,
    vi.customer_id,
    c.name AS customer_name,
    vi.customer_contract_id,
    cc.contract_number,
    vi.calendar_id,
    vi.is_bank_holiday,
    vi.notes,
    vi.org_id
FROM visit_instances vi
JOIN users u ON u.id = vi.engineer_id
JOIN customers c ON c.id = vi.customer_id
LEFT JOIN customer_contracts cc ON cc.id = vi.customer_contract_id
WHERE vi.status NOT IN ('cancelled');

CREATE VIEW v_slot_templates_overview AS
SELECT
    vst.id,
    vst.day_of_week,
    vst.time_slot,
    vst.cycle_weeks,
    vst.default_start_time,
    vst.default_end_time,
    vst.override_start_time,
    vst.override_end_time,
    vst.status,
    vst.engineer_id,
    u.first_name || ' ' || u.last_name AS engineer_name,
    u.color AS engineer_color,
    vst.customer_id,
    c.name AS customer_name,
    vst.customer_contract_id,
    cc.contract_number,
    ct.name AS contract_type_name,
    vst.notes,
    vst.org_id
FROM visit_slot_templates vst
JOIN users u ON u.id = vst.engineer_id
JOIN customers c ON c.id = vst.customer_id
LEFT JOIN customer_contracts cc ON cc.id = vst.customer_contract_id
LEFT JOIN contract_types ct ON ct.id = cc.contract_type_id;

-- ============================================================
-- RLS Policies — visit_settings
-- ============================================================
ALTER TABLE visit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_settings_select" ON visit_settings FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "visit_settings_insert" ON visit_settings FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "visit_settings_update" ON visit_settings FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — bank_holidays
-- ============================================================
ALTER TABLE bank_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_holidays_select" ON bank_holidays FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_holidays_insert" ON bank_holidays FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "bank_holidays_delete" ON bank_holidays FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — visit_calendars
-- ============================================================
ALTER TABLE visit_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_calendars_select" ON visit_calendars FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "visit_calendars_insert" ON visit_calendars FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_calendars_update" ON visit_calendars FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_calendars_delete" ON visit_calendars FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — visit_calendar_weeks (follows parent calendar)
-- ============================================================
ALTER TABLE visit_calendar_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_calendar_weeks_select" ON visit_calendar_weeks FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM visit_calendars vc
                WHERE vc.id = visit_calendar_weeks.calendar_id
                AND vc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
    );

CREATE POLICY "visit_calendar_weeks_insert" ON visit_calendar_weeks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM visit_calendars vc
            WHERE vc.id = visit_calendar_weeks.calendar_id
            AND vc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
            )
        )
    );

CREATE POLICY "visit_calendar_weeks_update" ON visit_calendar_weeks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM visit_calendars vc
            WHERE vc.id = visit_calendar_weeks.calendar_id
            AND vc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
            )
        )
    );

CREATE POLICY "visit_calendar_weeks_delete" ON visit_calendar_weeks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM visit_calendars vc
            WHERE vc.id = visit_calendar_weeks.calendar_id
            AND vc.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
            )
        )
    );

-- ============================================================
-- RLS Policies — visit_slot_templates
-- ============================================================
ALTER TABLE visit_slot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_slot_templates_select" ON visit_slot_templates FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "visit_slot_templates_insert" ON visit_slot_templates FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_slot_templates_update" ON visit_slot_templates FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_slot_templates_delete" ON visit_slot_templates FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- RLS Policies — visit_instances
-- ============================================================
ALTER TABLE visit_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_instances_select" ON visit_instances FOR SELECT
    USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "visit_instances_insert" ON visit_instances FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_instances_update" ON visit_instances FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin', 'engineering')
        )
    );

CREATE POLICY "visit_instances_delete" ON visit_instances FOR DELETE
    USING (
        org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_id = auth.uid() AND r.name IN ('super_admin', 'admin')
        )
    );

-- ============================================================
-- Permissions
-- ============================================================
INSERT INTO permissions (module, action, description) VALUES
    ('visit_scheduling', 'view', 'View visit schedules'),
    ('visit_scheduling', 'create', 'Create visit schedules'),
    ('visit_scheduling', 'edit', 'Edit visit schedules'),
    ('visit_scheduling', 'delete', 'Delete visit schedules')
ON CONFLICT (module, action) DO NOTHING;

-- admin / super_admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'visit_scheduling'
ON CONFLICT DO NOTHING;

-- engineering: view + create + edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'visit_scheduling'
AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- sales: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'visit_scheduling'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- accounts: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module = 'visit_scheduling'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- purchasing: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module = 'visit_scheduling'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: England bank holidays 2025-26 academic year
-- ============================================================
-- These will be inserted per-org by the seed action, not here.
-- Default visit settings will also be created by the seed action.
