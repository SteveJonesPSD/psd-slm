-- =============================================================================
-- Helen AI Diagnostic Assist + Scratchpad
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. helen_assist_log — tracks every "Help me Fix This" call
-- -----------------------------------------------------------------------------
CREATE TABLE helen_assist_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id),
  org_id        UUID NOT NULL REFERENCES organisations(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  request_summary TEXT,
  response_body TEXT,
  category_id   UUID REFERENCES ticket_categories(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helen_assist_log_org      ON helen_assist_log(org_id);
CREATE INDEX idx_helen_assist_log_user     ON helen_assist_log(user_id);
CREATE INDEX idx_helen_assist_log_ticket   ON helen_assist_log(ticket_id);
CREATE INDEX idx_helen_assist_log_created  ON helen_assist_log(created_at);

ALTER TABLE helen_assist_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helen_assist_log_select" ON helen_assist_log
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "helen_assist_log_insert" ON helen_assist_log
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. ticket_scratchpad_notes — private per-ticket notes
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_scratchpad_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organisations(id),
  created_by    UUID NOT NULL REFERENCES users(id),
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'helen_assist')),
  assist_log_id UUID REFERENCES helen_assist_log(id),
  title         TEXT,
  body          TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scratchpad_notes_ticket ON ticket_scratchpad_notes(ticket_id);
CREATE INDEX idx_scratchpad_notes_org    ON ticket_scratchpad_notes(org_id);

ALTER TABLE ticket_scratchpad_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scratchpad_notes_select" ON ticket_scratchpad_notes
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "scratchpad_notes_insert" ON ticket_scratchpad_notes
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "scratchpad_notes_update" ON ticket_scratchpad_notes
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "scratchpad_notes_delete" ON ticket_scratchpad_notes
  FOR DELETE USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. v_helen_assist_usage — reporting view
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_helen_assist_usage AS
SELECT
  h.id,
  h.org_id,
  h.ticket_id,
  h.user_id,
  h.model,
  h.input_tokens,
  h.output_tokens,
  h.input_tokens + h.output_tokens AS total_tokens,
  h.category_id,
  h.created_at,
  t.ticket_number,
  u.first_name || ' ' || u.last_name AS user_name,
  c.name AS category_name
FROM helen_assist_log h
  JOIN tickets t ON t.id = h.ticket_id
  JOIN users u ON u.id = h.user_id
  LEFT JOIN ticket_categories c ON c.id = h.category_id;
