-- Add theme preference to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'system';
ALTER TABLE users ADD CONSTRAINT users_theme_preference_check CHECK (theme_preference IN ('light', 'dark', 'system'));
