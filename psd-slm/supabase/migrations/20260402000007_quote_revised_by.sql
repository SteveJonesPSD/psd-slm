-- Add revised_by column to track who created each revision
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revised_by uuid REFERENCES users(id);
