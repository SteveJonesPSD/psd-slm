-- ============================================================================
-- SYSTEM PRESENCE — ephemeral "who is online" tracking for sidebar avatars
-- ============================================================================

CREATE TABLE system_presence (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_presence_org ON system_presence (org_id);
CREATE INDEX idx_system_presence_heartbeat ON system_presence (last_heartbeat);

-- ============================================================================
-- RLS — org-scoped with own-user restriction for writes
-- ============================================================================

ALTER TABLE system_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_presence_select ON system_presence FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY system_presence_insert ON system_presence FOR INSERT
  WITH CHECK (
    org_id = auth_org_id()
    AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY system_presence_update ON system_presence FOR UPDATE
  USING (
    org_id = auth_org_id()
    AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY system_presence_delete ON system_presence FOR DELETE
  USING (
    org_id = auth_org_id()
    AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
