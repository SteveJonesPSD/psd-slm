-- Teams notification settings stored in org_settings (key/value)
-- Keys added:
--   teams_notifications_enabled   (boolean, default false)
--   teams_webhook_url             (text, optional — for webhook fallback)
--   teams_team_id                 (text — Graph team ID)
--   teams_channel_id              (text — Graph channel ID)
--   teams_notify_job_assigned     (boolean, default true)
--   teams_notify_job_rescheduled  (boolean, default true)
--   teams_notify_job_cancelled    (boolean, default true)

-- Engineer M365 UPN on users table (used for @mention)
ALTER TABLE users ADD COLUMN IF NOT EXISTS teams_upn TEXT;
COMMENT ON COLUMN users.teams_upn IS 'M365 User Principal Name (email) for Teams @mention, e.g. dan.whittle@psdgroup.co.uk';
