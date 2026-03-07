-- Trusted devices for remember-device session persistence
CREATE TABLE trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_device_token ON trusted_devices(device_token);
CREATE INDEX idx_trusted_devices_expires_at ON trusted_devices(expires_at);

-- RLS
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON trusted_devices FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own devices"
  ON trusted_devices FOR DELETE
  USING (user_id = auth.uid());

-- Insert/update via admin client only (server actions)
