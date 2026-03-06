-- Add title field to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS title TEXT;
