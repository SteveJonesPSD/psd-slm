-- =============================================================================
-- Customer Portal — Magic Link Auth, Sessions, Chat
-- =============================================================================

-- Portal users: contacts granted portal access
CREATE TABLE IF NOT EXISTS portal_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  contact_id      UUID NOT NULL REFERENCES contacts(id),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  is_portal_admin BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  invited_by      UUID REFERENCES users(id),
  invited_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, contact_id)
);

-- Short-lived magic link tokens (15 min TTL, single-use)
CREATE TABLE IF NOT EXISTS portal_magic_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Persistent sessions (7-day sliding TTL)
CREATE TABLE IF NOT EXISTS portal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  session_token   TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  last_active_at  TIMESTAMPTZ DEFAULT now(),
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Portal chat sessions (separate from internal chat_sessions)
CREATE TABLE IF NOT EXISTS portal_chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL CHECK (agent_id IN ('helen', 'lucia', 'jasper')),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES portal_chat_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Add is_customer_facing to kb_articles if the table exists
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kb_articles') THEN
    ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS is_customer_facing BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add portal_notes to contract_visit_slots if the table exists
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contract_visit_slots') THEN
    ALTER TABLE contract_visit_slots ADD COLUMN IF NOT EXISTS portal_notes TEXT;
  END IF;
END $$;

-- Add actor_type and portal_user_id to activity_log if it exists
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_log') THEN
    ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'user';
    ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES portal_users(id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token       ON portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_user        ON portal_sessions(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires     ON portal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_portal_magic_links_token    ON portal_magic_links(token);
CREATE INDEX IF NOT EXISTS idx_portal_magic_links_expires  ON portal_magic_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_portal_users_contact        ON portal_users(contact_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_customer       ON portal_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_chat_sessions_user   ON portal_chat_sessions(portal_user_id);

-- RLS: all portal tables are accessed via service role (createAdminClient) from API routes only
ALTER TABLE portal_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_magic_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_chat_messages ENABLE ROW LEVEL SECURITY;

-- No RLS policies — only accessible via admin client in API routes
-- This matches the pattern used by job_collections confirm endpoint
