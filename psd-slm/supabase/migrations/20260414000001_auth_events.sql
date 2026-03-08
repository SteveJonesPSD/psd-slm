-- Auth events table — records all authentication activity
-- Separate from activity_log: different retention, different consumer, different legal basis (legitimate interest)
-- IP addresses: truncated (last octet zeroed) — GDPR-defensible, documented in Article 30
-- User agent: classified string only (e.g. 'Chrome/Windows') — not raw UA string

CREATE TABLE IF NOT EXISTS auth_events (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id          UUID,
  portal_user_id   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  auth_method      TEXT,
  success          BOOLEAN NOT NULL DEFAULT true,
  failure_reason   TEXT,
  ip_truncated     TEXT,
  user_agent_class TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT auth_events_event_type_check CHECK (event_type IN (
    'login_success', 'login_failure', 'logout', 'session_expired',
    'mfa_success', 'mfa_failure',
    'passkey_registered', 'passkey_auth_success', 'passkey_auth_failure', 'passkey_deleted',
    'magic_link_requested', 'magic_link_used',
    'password_reset_requested', 'password_changed',
    'portal_login_success', 'portal_login_failure'
  ))
);

CREATE INDEX IF NOT EXISTS idx_auth_events_org_created ON auth_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_failures ON auth_events(org_id, success, created_at DESC) WHERE success = false;

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_events_admin_read" ON auth_events;
CREATE POLICY "auth_events_admin_read" ON auth_events
  FOR SELECT USING (
    org_id = auth_org_id()
    AND auth_has_permission('settings', 'view')
  );

DROP POLICY IF EXISTS "auth_events_service_insert" ON auth_events;
CREATE POLICY "auth_events_service_insert" ON auth_events
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE auth_events IS 'Authentication audit log. 90-day rolling retention. Legal basis: legitimate interest (security monitoring). Documented in Article 30.';
