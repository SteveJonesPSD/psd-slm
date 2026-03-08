-- ============================================================================
-- Onsite Job Items (OJI) Module
-- Allows portal users and internal staff to log support jobs for onsite visits
-- ============================================================================

-- ============================================================================
-- 1. ONSITE JOB CATEGORIES
-- ============================================================================

CREATE TABLE onsite_job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colour TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oji_categories_org ON onsite_job_categories(org_id);

ALTER TABLE onsite_job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON onsite_job_categories
  USING (org_id = auth_org_id());

-- Seed default categories
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'Hardware Fault',        '#EF4444', 1 FROM organisations LIMIT 1;
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'Software Issue',        '#F59E0B', 2 FROM organisations LIMIT 1;
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'Network Problem',       '#3B82F6', 3 FROM organisations LIMIT 1;
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'Printer / Peripheral',  '#8B5CF6', 4 FROM organisations LIMIT 1;
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'New User Setup',        '#10B981', 5 FROM organisations LIMIT 1;
INSERT INTO onsite_job_categories (org_id, name, colour, sort_order)
SELECT id, 'General IT Support',    '#6B7280', 6 FROM organisations LIMIT 1;

-- ============================================================================
-- 2. ONSITE JOB ITEMS
-- ============================================================================

CREATE TABLE onsite_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ref_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visit_instance_id UUID REFERENCES visit_instances(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('portal', 'ticket_push', 'internal', 'escalation')),
  source_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  room_location TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category_id UUID REFERENCES onsite_job_categories(id) ON DELETE SET NULL,
  requested_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  on_behalf_of_name TEXT,
  on_behalf_of_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  preferred_datetime TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete', 'escalated', 'cancelled')),
  engineer_notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notify_sales_at TIMESTAMPTZ,
  escalation_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  created_by_portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oji_org ON onsite_job_items(org_id);
CREATE INDEX idx_oji_customer ON onsite_job_items(org_id, customer_id);
CREATE INDEX idx_oji_status ON onsite_job_items(org_id, status);
CREATE INDEX idx_oji_visit ON onsite_job_items(visit_instance_id) WHERE visit_instance_id IS NOT NULL;
CREATE INDEX idx_oji_ref ON onsite_job_items(org_id, ref_number);

ALTER TABLE onsite_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON onsite_job_items
  USING (org_id = auth_org_id());

-- Ref number trigger
CREATE OR REPLACE FUNCTION generate_oji_ref_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_year TEXT;
  v_next INTEGER;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(ref_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_next
  FROM onsite_job_items
  WHERE org_id = NEW.org_id
    AND ref_number LIKE 'OJI-' || v_year || '-%';

  NEW.ref_number := 'OJI-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_oji_ref_number
  BEFORE INSERT ON onsite_job_items
  FOR EACH ROW EXECUTE FUNCTION generate_oji_ref_number();

-- Generic updated_at function (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- Updated_at trigger
CREATE TRIGGER trg_oji_updated_at
  BEFORE UPDATE ON onsite_job_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. ONSITE JOB AUDIT
-- ============================================================================

CREATE TABLE onsite_job_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  onsite_job_item_id UUID NOT NULL REFERENCES onsite_job_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'status_changed', 'note_added', 'engineer_note',
    'sales_notified', 'ticket_pushed_to', 'ticket_closed_source',
    'escalated', 'visit_linked', 'cancelled'
  )),
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('portal_user', 'internal_user', 'system')),
  actor_portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oji_audit_item ON onsite_job_audit(onsite_job_item_id);
CREATE INDEX idx_oji_audit_org ON onsite_job_audit(org_id);

ALTER TABLE onsite_job_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON onsite_job_audit
  USING (org_id = auth_org_id());

-- ============================================================================
-- 4. ORG SETTINGS SEED
-- ============================================================================

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'onsite_jobs', 'sales_alert_email', '""'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'onsite_jobs', 'portal_enabled', 'true'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'onsite_jobs', 'auto_link_visit', 'true'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

-- ============================================================================
-- 5. PERMISSIONS
-- ============================================================================

INSERT INTO permissions (module, action, description) VALUES
  ('onsite_jobs', 'view', 'View onsite job items'),
  ('onsite_jobs', 'create', 'Create onsite job items'),
  ('onsite_jobs', 'edit', 'Edit onsite job items'),
  ('onsite_jobs', 'push_ticket', 'Push tickets to onsite jobs'),
  ('onsite_jobs', 'notify_sales', 'Send sales notifications for onsite jobs'),
  ('onsite_jobs', 'cancel', 'Cancel onsite job items'),
  ('onsite_jobs', 'admin', 'Manage onsite job categories and settings')
ON CONFLICT (module, action) DO NOTHING;

-- super_admin / admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'onsite_jobs'
ON CONFLICT DO NOTHING;

-- tech: view, create, edit, push_ticket, notify_sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('tech', 'engineering')
AND p.module = 'onsite_jobs'
AND p.action IN ('view', 'create', 'edit', 'push_ticket', 'notify_sales')
ON CONFLICT DO NOTHING;

-- field_engineer: view, edit, notify_sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'field_engineer'
AND p.module = 'onsite_jobs'
AND p.action IN ('view', 'edit', 'notify_sales')
ON CONFLICT DO NOTHING;

-- sales: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'onsite_jobs'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- finance/accounts: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('finance', 'accounts')
AND p.module = 'onsite_jobs'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
