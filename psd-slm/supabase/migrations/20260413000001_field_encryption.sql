-- Field encryption companion columns
-- contacts.email_domain already exists and is populated — just ensure index

-- ── contacts ──────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_blind TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_email_domain
  ON contacts(email_domain);

CREATE INDEX IF NOT EXISTS idx_contacts_email_blind
  ON contacts(email_blind);

-- ── customers ─────────────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_blind TEXT,
  ADD COLUMN IF NOT EXISTS postcode_area TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_email_blind
  ON customers(email_blind);

CREATE INDEX IF NOT EXISTS idx_customers_postcode_area
  ON customers(postcode_area);

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_blind TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email_blind
  ON users(email_blind);

-- ── tickets ───────────────────────────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS thread_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS search_tokens TSVECTOR,
  ADD COLUMN IF NOT EXISTS sender_email_blind TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_search_tokens
  ON tickets USING GIN(search_tokens);

CREATE INDEX IF NOT EXISTS idx_tickets_sender_email_blind
  ON tickets(sender_email_blind);

-- ── Helper function for updating ticket search tokens from the DAL ───────────
CREATE OR REPLACE FUNCTION update_ticket_search_tokens(
  p_ticket_id UUID,
  p_content TEXT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tickets
  SET search_tokens = to_tsvector('english', p_content)
  WHERE id = p_ticket_id;
END;
$$;
