-- Ticket auto-close: add hold_open flag, waiting_since timestamp, and warning tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS hold_open BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS auto_close_warning_sent_at TIMESTAMPTZ;
