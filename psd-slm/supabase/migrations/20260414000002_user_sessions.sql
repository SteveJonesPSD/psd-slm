-- User sessions table — tracks active sessions for idle detection and engagement reporting
-- session_token stores a HMAC-SHA256 hash of the JWT sub+iat — never the raw token

CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  session_token   TEXT NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_active_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  idle_since      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  end_reason      TEXT,

  CONSTRAINT user_sessions_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('logout', 'expired', 'replaced')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_org_user ON user_sessions(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(org_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sessions_own_read" ON user_sessions;
CREATE POLICY "user_sessions_own_read" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_sessions_admin_read" ON user_sessions;
CREATE POLICY "user_sessions_admin_read" ON user_sessions
  FOR SELECT USING (
    org_id = auth_org_id()
    AND auth_has_permission('settings', 'view')
  );

DROP POLICY IF EXISTS "user_sessions_service_write" ON user_sessions;
CREATE POLICY "user_sessions_service_write" ON user_sessions
  FOR ALL WITH CHECK (true);

COMMENT ON TABLE user_sessions IS 'Active and historical user sessions. Used for idle detection and staff engagement reporting. 30-day rolling retention.';
