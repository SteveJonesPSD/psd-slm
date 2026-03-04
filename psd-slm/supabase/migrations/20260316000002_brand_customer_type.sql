-- Add customer_type to brands
-- Allows brands to be associated with a specific customer type (education, business, charity, public_sector)
-- NULL means "available for all types" (universal brand)

ALTER TABLE brands ADD COLUMN IF NOT EXISTS customer_type TEXT;
