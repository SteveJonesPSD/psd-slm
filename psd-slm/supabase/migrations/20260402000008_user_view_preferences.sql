-- Per-user default view preferences (quotes filter, pipeline filter, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS view_preferences jsonb DEFAULT '{}';

COMMENT ON COLUMN users.view_preferences IS 'Per-user default view preferences JSON, e.g. {"quotes_owner":"mine","quotes_status":"sent","pipeline_owner":"mine"}';
