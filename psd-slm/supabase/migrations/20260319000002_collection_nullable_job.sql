-- ============================================================================
-- Make job_id nullable on job_collections
-- Collections can be created directly from an SO without a linked job
-- ============================================================================

ALTER TABLE job_collections ALTER COLUMN job_id DROP NOT NULL;

-- Update the index to handle nulls
DROP INDEX IF EXISTS idx_job_collections_job;
CREATE INDEX IF NOT EXISTS idx_job_collections_job ON job_collections(job_id) WHERE job_id IS NOT NULL;

-- Add index on sales_order_id for SO-driven queries
CREATE INDEX IF NOT EXISTS idx_job_collections_so ON job_collections(sales_order_id) WHERE sales_order_id IS NOT NULL;
