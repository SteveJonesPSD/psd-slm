-- ============================================================================
-- TICKET PRESENCE — ephemeral "who is viewing" tracking for collision warnings
-- ============================================================================

CREATE TABLE ticket_presence (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX idx_ticket_presence_heartbeat ON ticket_presence (last_heartbeat);

-- ============================================================================
-- RLS — org-scoped via parent ticket join (same pattern as ticket_watchers)
-- ============================================================================

ALTER TABLE ticket_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_presence_select ON ticket_presence FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

CREATE POLICY ticket_presence_insert ON ticket_presence FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

CREATE POLICY ticket_presence_update ON ticket_presence FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

CREATE POLICY ticket_presence_delete ON ticket_presence FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
