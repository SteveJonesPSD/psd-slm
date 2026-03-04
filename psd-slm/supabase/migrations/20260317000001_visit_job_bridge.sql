-- Visit ↔ Job Bridge
-- Links confirmed visit instances to scheduling jobs so both appear on the dispatch calendar.

-- 1. Add 'visit' to the jobs.source_type CHECK constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_type_check
  CHECK (source_type IN ('manual', 'sales_order', 'ticket', 'contract', 'visit'));

-- 2. Add job_id FK on visit_instances
ALTER TABLE visit_instances ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- 3. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_visit_instances_job_id ON visit_instances(job_id) WHERE job_id IS NOT NULL;

-- 4. Prevent duplicate jobs per visit (one job per visit instance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_visit_source_unique ON jobs(source_id) WHERE source_type = 'visit';
