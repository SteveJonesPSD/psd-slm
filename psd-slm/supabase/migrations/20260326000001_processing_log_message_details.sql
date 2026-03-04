-- Add per-message detail tracking to mail processing log
ALTER TABLE mail_processing_log
ADD COLUMN message_details JSONB DEFAULT '[]';
