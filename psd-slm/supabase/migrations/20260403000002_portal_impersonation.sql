-- Add impersonation tracking to portal_sessions
ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS is_impersonation BOOLEAN DEFAULT FALSE;
ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS impersonated_by UUID REFERENCES users(id);
