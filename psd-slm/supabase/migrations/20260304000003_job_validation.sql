-- ============================================================================
-- JOB VALIDATION & REPORTING
-- ============================================================================
-- Completed jobs can be validated by office staff. Once validated, a job report
-- PDF is generated and can be sent to the nominated contact.

-- Add validation fields to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS validation_notes text;

-- Job reports table — tracks generated PDF reports
CREATE TABLE IF NOT EXISTS job_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  generated_by  uuid NOT NULL REFERENCES users(id),
  sent_at       timestamptz,
  sent_to       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_reports_job ON job_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_job_reports_org ON job_reports(org_id);

-- Storage bucket for job report PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-reports', 'job-reports', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-reports bucket
CREATE POLICY "Org users can read job reports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-reports' AND auth.uid() IS NOT NULL);

CREATE POLICY "Org users can upload job reports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-reports' AND auth.uid() IS NOT NULL);

-- RLS for job_reports table
ALTER TABLE job_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_reports_select ON job_reports
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY job_reports_insert ON job_reports
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );
