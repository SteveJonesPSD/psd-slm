-- Add auto_nudge_sent_at column to tickets table for tracking AI nudge sends
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS auto_nudge_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN tickets.auto_nudge_sent_at IS 'Timestamp when the auto-nudge was sent for the current waiting period. Reset when waiting_since is reset.';
