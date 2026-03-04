-- ============================================================================
-- Ticket Merges — merge duplicate/related tickets into a single thread
-- Migration: 20260312000001_ticket_merges
-- ============================================================================

-- ============================================================================
-- 1. ALTER TICKETS TABLE
-- ============================================================================

-- Pointer from source ticket to the target (live) ticket
ALTER TABLE tickets ADD COLUMN merged_into_ticket_id UUID REFERENCES tickets(id);

-- Preserve the source ticket's status before merge so we can restore on un-merge
ALTER TABLE tickets ADD COLUMN pre_merge_status TEXT;

CREATE INDEX idx_tickets_merged_into ON tickets(merged_into_ticket_id) WHERE merged_into_ticket_id IS NOT NULL;

-- ============================================================================
-- 2. TICKET MERGES TABLE (audit trail)
-- ============================================================================

CREATE TABLE ticket_merges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  source_ticket_id UUID NOT NULL REFERENCES tickets(id),
  target_ticket_id UUID NOT NULL REFERENCES tickets(id),
  merged_by UUID NOT NULL REFERENCES users(id),
  merged_at TIMESTAMPTZ DEFAULT now(),
  source_snapshot JSONB NOT NULL DEFAULT '{}',
  unmerged_at TIMESTAMPTZ,
  unmerged_by UUID REFERENCES users(id),
  UNIQUE(source_ticket_id, target_ticket_id)
);

CREATE INDEX idx_ticket_merges_org ON ticket_merges(org_id);
CREATE INDEX idx_ticket_merges_source ON ticket_merges(source_ticket_id);
CREATE INDEX idx_ticket_merges_target ON ticket_merges(target_ticket_id);
CREATE INDEX idx_ticket_merges_active ON ticket_merges(target_ticket_id) WHERE unmerged_at IS NULL;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE ticket_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_merges_select ON ticket_merges
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY ticket_merges_insert ON ticket_merges
  FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'edit'));

CREATE POLICY ticket_merges_update ON ticket_merges
  FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'edit'));

-- ============================================================================
-- 4. UPDATE v_ticket_summary VIEW
-- Must DROP first — CREATE OR REPLACE cannot add columns before existing ones
-- ============================================================================

DROP VIEW IF EXISTS v_ticket_summary;
CREATE VIEW v_ticket_summary AS
SELECT
  t.id,
  t.org_id,
  t.ticket_number,
  t.subject,
  t.status,
  t.priority,
  t.ticket_type,
  t.created_at,
  t.updated_at,
  t.sla_response_due_at,
  t.sla_resolution_due_at,
  t.first_responded_at,
  t.resolved_at,
  t.sla_response_met,
  t.sla_resolution_met,
  t.escalation_level,
  c.id AS customer_id,
  c.name AS customer_name,
  ct.id AS contact_id,
  ct.first_name || ' ' || ct.last_name AS contact_name,
  u.id AS assigned_to_id,
  u.first_name || ' ' || u.last_name AS assigned_to_name,
  u.initials AS assigned_to_initials,
  u.color AS assigned_to_color,
  tc.name AS category_name,
  b.name AS brand_name,
  t.brand_id,
  t.category_id,
  t.contract_id,
  t.assigned_to,
  t.created_by,
  t.merged_into_ticket_id,
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;
