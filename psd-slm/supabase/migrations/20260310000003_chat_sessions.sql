-- Chat sessions: persist AI agent conversations across login sessions
-- Each user has one active session per agent (helen, jasper, lucia)

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('helen', 'jasper', 'lucia')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, agent_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY chat_sessions_select ON chat_sessions FOR SELECT USING (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY chat_sessions_insert ON chat_sessions FOR INSERT WITH CHECK (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY chat_sessions_update ON chat_sessions FOR UPDATE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY chat_sessions_delete ON chat_sessions FOR DELETE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Messages inherit access from session ownership
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (
  session_id IN (
    SELECT id FROM chat_sessions
    WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  session_id IN (
    SELECT id FROM chat_sessions
    WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE USING (
  session_id IN (
    SELECT id FROM chat_sessions
    WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);
