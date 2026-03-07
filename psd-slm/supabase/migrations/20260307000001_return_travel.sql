-- Return travel tracking for field engineers
-- Adds return_travelling and closed statuses, departure/return timestamps

-- 1. Extend job status CHECK constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('unscheduled', 'scheduled', 'travelling', 'on_site', 'completed', 'return_travelling', 'closed', 'cancelled'));

-- 2. Add timestamp columns for departure and return arrival
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS return_arrived_at TIMESTAMPTZ;

-- 3. Extend GPS event types
ALTER TABLE job_gps_log DROP CONSTRAINT IF EXISTS job_gps_log_event_type_check;
ALTER TABLE job_gps_log ADD CONSTRAINT job_gps_log_event_type_check
  CHECK (event_type IN ('travel_started', 'arrived', 'completed', 'note_added', 'task_toggled', 'photo_added', 'status_changed', 'departed', 'return_arrived'));
