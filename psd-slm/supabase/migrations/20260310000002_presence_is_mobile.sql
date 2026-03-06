-- Add is_mobile flag to system_presence for mobile device detection
ALTER TABLE system_presence ADD COLUMN is_mobile BOOLEAN NOT NULL DEFAULT false;
