-- WebAuthn passkey credentials
-- Each user can have multiple passkeys (e.g. Face ID on phone + Touch ID on laptop)
CREATE TABLE user_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,

  -- WebAuthn credential data
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  credential_device_type TEXT NOT NULL,
  credential_backed_up BOOLEAN NOT NULL DEFAULT false,

  -- User-facing metadata
  device_name TEXT NOT NULL DEFAULT 'Passkey',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Transport hints for the browser (usb, ble, nfc, internal)
  transports TEXT[]
);

CREATE INDEX idx_user_passkeys_user_id ON user_passkeys(user_id);
CREATE INDEX idx_user_passkeys_credential_id ON user_passkeys(credential_id);

-- Temporary challenge storage for WebAuthn ceremonies
-- Challenges are short-lived (5 min TTL) and consumed on verification
CREATE TABLE passkey_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_passkey_challenges_expires ON passkey_challenges(expires_at);

-- RLS
ALTER TABLE user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;

-- Users can view their own passkeys
CREATE POLICY "Users can view own passkeys"
  ON user_passkeys FOR SELECT
  USING (user_id = auth.uid());

-- Users can delete their own passkeys
CREATE POLICY "Users can delete own passkeys"
  ON user_passkeys FOR DELETE
  USING (user_id = auth.uid());

-- All passkey writes and challenge operations via admin client only

-- Cleanup function for expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM passkey_challenges WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
