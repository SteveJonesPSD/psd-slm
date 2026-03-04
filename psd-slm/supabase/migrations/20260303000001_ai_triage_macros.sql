-- ============================================================================
-- AI Auto-Triage & Automation Macros
-- Migration: 20260303000001_ai_triage_macros
-- ============================================================================

-- ============================================================================
-- 1. ADD is_ai_assignable TO ticket_tags
-- ============================================================================
ALTER TABLE ticket_tags ADD COLUMN IF NOT EXISTS is_ai_assignable BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. AUTOMATION MACROS
-- ============================================================================
CREATE TABLE automation_macros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  trigger_type TEXT NOT NULL DEFAULT 'tag_applied'
    CHECK (trigger_type IN ('tag_applied', 'priority_set', 'status_changed')),
  trigger_conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_macros_org_active ON automation_macros(org_id) WHERE is_active = true;

-- ============================================================================
-- 3. TRIAGE LOG (audit trail)
-- ============================================================================
CREATE TABLE triage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id),
  tags_assigned UUID[] DEFAULT '{}',
  tags_existing UUID[] DEFAULT '{}',
  ai_reasoning TEXT,
  macros_executed UUID[] DEFAULT '{}',
  processing_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_triage_log_ticket ON triage_log(ticket_id);

-- ============================================================================
-- 4. ENABLE RLS
-- ============================================================================
ALTER TABLE automation_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- automation_macros — org-scoped select, helpdesk.admin for mutations
CREATE POLICY automation_macros_select ON automation_macros FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY automation_macros_insert ON automation_macros FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY automation_macros_update ON automation_macros FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY automation_macros_delete ON automation_macros FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- triage_log — org-scoped select and insert
CREATE POLICY triage_log_select ON triage_log FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY triage_log_insert ON triage_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());
