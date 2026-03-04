-- Migration: Add receive goods / service item columns to sales_order_lines
-- Required for: goods-in workflow, serial number capture, service item detection

-- 1. Add new columns
ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS quantity_received INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS serial_numbers_received TEXT[] DEFAULT '{}';

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false;

-- 2. Allow NULL on delivery_destination (service items have no destination)
ALTER TABLE sales_order_lines
  ALTER COLUMN delivery_destination DROP NOT NULL;

ALTER TABLE sales_order_lines
  ALTER COLUMN delivery_destination DROP DEFAULT;

-- 3. Update check constraint on delivery_destination to allow NULL
ALTER TABLE sales_order_lines
  DROP CONSTRAINT IF EXISTS sales_order_lines_delivery_destination_check;

ALTER TABLE sales_order_lines
  ADD CONSTRAINT sales_order_lines_delivery_destination_check
    CHECK (delivery_destination IS NULL OR delivery_destination IN ('psd_office', 'customer_site'));

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
