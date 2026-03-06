-- Add use_for_pos flag to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS use_for_pos BOOLEAN DEFAULT false;

-- Add address fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'GB';
