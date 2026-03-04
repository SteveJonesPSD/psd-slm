-- AI Suggest preferences
-- Global settings use existing org_settings table (category 'ai_suggest')
-- Individual preferences stored as JSONB on users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}';
