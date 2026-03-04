-- ============================================================================
-- JOB GPS LOG — captures device coordinates on every job interaction
-- ============================================================================

CREATE TABLE job_gps_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'travel_started', 'arrived', 'completed', 'note_added',
    'task_toggled', 'photo_added', 'status_changed'
  )),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_metres DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_job_gps_log_job ON job_gps_log (job_id);
CREATE INDEX idx_job_gps_log_org ON job_gps_log (org_id);

-- ============================================================================
-- RLS — org-scoped read/write
-- ============================================================================

ALTER TABLE job_gps_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_gps_log_select ON job_gps_log FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY job_gps_log_insert ON job_gps_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());
