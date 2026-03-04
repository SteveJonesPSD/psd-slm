-- Add accepted_by_type to track HOW a quote was accepted
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_by_type TEXT;

-- Backfill existing accepted quotes as portal-accepted (since portal was the only way before)
UPDATE quotes SET accepted_by_type = 'customer_portal' WHERE status = 'accepted' AND accepted_by_type IS NULL;

COMMENT ON COLUMN quotes.accepted_by_type IS 'How the quote was accepted: customer_portal, internal_manual, internal_ai_accept';
