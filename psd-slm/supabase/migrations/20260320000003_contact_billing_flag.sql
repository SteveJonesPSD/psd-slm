-- Add billing contact flag to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_billing BOOLEAN DEFAULT false;
