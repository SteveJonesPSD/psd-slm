-- ============================================================================
-- Helen AI Helpdesk Agent
-- Migration: 20260303000002_helen_ai_agent
-- ============================================================================

-- ============================================================================
-- 1. HELEN DRAFT RESPONSES TABLE
-- ============================================================================
CREATE TABLE helen_draft_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id),
  draft_type TEXT NOT NULL DEFAULT 'triage_response'
    CHECK (draft_type IN ('triage_response', 'needs_detail')),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_sent')),
  ai_reasoning TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  edited_body TEXT,
  message_id UUID REFERENCES ticket_messages(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_helen_drafts_ticket ON helen_draft_responses(ticket_id);
CREATE INDEX idx_helen_drafts_pending ON helen_draft_responses(org_id) WHERE status = 'pending';

-- ============================================================================
-- 2. EXTEND TRIAGE_LOG
-- ============================================================================
ALTER TABLE triage_log ADD COLUMN IF NOT EXISTS ack_sent BOOLEAN DEFAULT false;
ALTER TABLE triage_log ADD COLUMN IF NOT EXISTS draft_id UUID;
ALTER TABLE triage_log ADD COLUMN IF NOT EXISTS draft_type TEXT;
ALTER TABLE triage_log ADD COLUMN IF NOT EXISTS tags_created UUID[] DEFAULT '{}';
ALTER TABLE triage_log ADD COLUMN IF NOT EXISTS auto_sent BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE helen_draft_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- helen_draft_responses — org-scoped select/insert, helpdesk.edit for update, helpdesk.admin for delete
CREATE POLICY helen_drafts_select ON helen_draft_responses FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY helen_drafts_insert ON helen_draft_responses FOR INSERT
  WITH CHECK (org_id = auth_org_id());
CREATE POLICY helen_drafts_update ON helen_draft_responses FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY helen_drafts_delete ON helen_draft_responses FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
