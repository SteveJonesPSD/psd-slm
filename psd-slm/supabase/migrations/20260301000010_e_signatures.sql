-- E-Signature support for quote acceptance
-- Adds signature capture fields to quotes and creates storage bucket

-- Add signature fields to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS signature_image_path TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT;

-- Create e-signatures storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('e-signatures', 'e-signatures', false, 524288, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read signatures
CREATE POLICY "Authenticated users can read signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'e-signatures');

-- Storage RLS: service role / admin client handles inserts (no user insert policy needed)
-- The portal accept route uses createAdminClient() which bypasses RLS
