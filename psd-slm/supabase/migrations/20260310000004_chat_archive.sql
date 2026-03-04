-- Chat archive: preserve conversation history when sessions are cleared
-- Admins can view all archived chats across the organisation

-- Add is_archived flag to sessions (archived sessions are hidden from users but kept for audit)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Drop the unique constraint so users can have multiple archived sessions per agent
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_agent_id_key;

-- Add a unique index only on active (non-archived) sessions
CREATE UNIQUE INDEX IF NOT EXISTS chat_sessions_active_unique
  ON chat_sessions(user_id, agent_id) WHERE is_archived = false;

-- Index for admin archive queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_archived
  ON chat_sessions(org_id, is_archived, updated_at DESC);

-- View for admin archive browsing (joins user info)
CREATE OR REPLACE VIEW v_chat_archive AS
SELECT
  cs.id AS session_id,
  cs.org_id,
  cs.user_id,
  cs.agent_id,
  cs.is_archived,
  cs.created_at,
  cs.updated_at,
  u.first_name,
  u.last_name,
  u.email,
  u.initials,
  u.color,
  (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count,
  (SELECT cm.content FROM chat_messages cm WHERE cm.session_id = cs.id AND cm.role = 'user' ORDER BY cm.created_at ASC LIMIT 1) AS first_message
FROM chat_sessions cs
JOIN users u ON u.id = cs.user_id;

-- Update RLS policies on chat_sessions: users only see their own non-archived sessions
-- (admins access archive via admin client which bypasses RLS)
DROP POLICY IF EXISTS chat_sessions_select ON chat_sessions;
CREATE POLICY chat_sessions_select ON chat_sessions FOR SELECT USING (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  AND user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  AND is_archived = false
);

-- Keep other policies as-is (insert/update/delete only affect user's own rows)
