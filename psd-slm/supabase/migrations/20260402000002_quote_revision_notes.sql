-- Add revision_notes column to quotes table
-- Optional field to record why a revision was created
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revision_notes TEXT;
