-- Add signature fields to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS engineer_signature_path TEXT,
  ADD COLUMN IF NOT EXISTS engineer_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_signature_path TEXT,
  ADD COLUMN IF NOT EXISTS customer_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_not_present BOOLEAN NOT NULL DEFAULT false;

-- Storage bucket for job signatures (private, PNG only, 512KB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-signatures', 'job-signatures', false, 524288, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload job signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-signatures');

-- Storage RLS: authenticated users can read
CREATE POLICY "Authenticated users can read job signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-signatures');
