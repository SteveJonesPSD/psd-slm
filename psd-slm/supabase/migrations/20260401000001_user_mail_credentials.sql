-- =============================================================================
-- User Mail Credentials
-- Per-user OAuth2 delegated credentials for sending email from personal M365 mailboxes.
-- Used for quote sending so emails appear in the salesperson's Sent Items.
-- =============================================================================

CREATE TABLE user_mail_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- RLS
ALTER TABLE user_mail_credentials ENABLE ROW LEVEL SECURITY;

-- Users can read their own credential (to check if connected)
CREATE POLICY "users_own_mail_creds_select" ON user_mail_credentials
  FOR SELECT USING (auth_org_id() = org_id AND auth.uid() = user_id);

-- Admin can do everything
CREATE POLICY "admin_all_mail_creds" ON user_mail_credentials
  FOR ALL USING (auth_org_id() = org_id AND auth_has_permission('email', 'edit'));

-- Index for fast lookup by user
CREATE INDEX idx_user_mail_credentials_user ON user_mail_credentials(user_id);
CREATE INDEX idx_user_mail_credentials_org ON user_mail_credentials(org_id);

-- Add quote_email_sends table to track email sends on quotes
CREATE TABLE quote_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  send_method TEXT NOT NULL CHECK (send_method IN ('pdf', 'portal', 'both')),
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_email TEXT NOT NULL,
  recipient_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  graph_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quote_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_email_sends_org" ON quote_email_sends
  FOR ALL USING (auth_org_id() = org_id);

CREATE INDEX idx_quote_email_sends_quote ON quote_email_sends(quote_id);
