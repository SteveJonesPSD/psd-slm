-- Add engineer signature fields to job_collections
-- Captures engineer identity and signature at collection confirmation time

ALTER TABLE job_collections
  ADD COLUMN engineer_signature_path TEXT,
  ADD COLUMN engineer_name TEXT,
  ADD COLUMN engineer_initials TEXT;
