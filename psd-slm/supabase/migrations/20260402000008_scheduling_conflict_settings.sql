-- Add scheduling working hours and travel buffer settings to org_settings
-- These are seeded as defaults; each org can override via the config UI

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'scheduling', 'working_day_start', '"08:00"'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'scheduling', 'working_day_end', '"17:30"'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'scheduling', 'travel_buffer_minutes', '15'
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;
