-- Push notification subscriptions (Web Push API)
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Notification preferences per user (which types trigger push)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_select ON push_subscriptions FOR SELECT
  USING (user_id IN (
    SELECT u.id FROM users u WHERE u.org_id = auth_org_id()
  ));

CREATE POLICY push_subscriptions_insert ON push_subscriptions FOR INSERT
  WITH CHECK (user_id IN (
    SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
  ));

CREATE POLICY push_subscriptions_delete ON push_subscriptions FOR DELETE
  USING (user_id IN (
    SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
  ));
