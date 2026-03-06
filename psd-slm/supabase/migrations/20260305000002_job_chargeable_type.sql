-- Add chargeable_type to jobs
ALTER TABLE jobs
  ADD COLUMN chargeable_type TEXT NOT NULL DEFAULT 'as_per_so'
    CHECK (chargeable_type IN ('as_per_so', 'no', 'contract', 'hourly'));
