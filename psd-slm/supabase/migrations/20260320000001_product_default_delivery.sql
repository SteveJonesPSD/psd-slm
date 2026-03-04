-- Add default delivery destination to products
-- Allows per-product configuration of where items should be delivered by default
-- 'psd_office' = Warehouse (default), 'customer_site' = Ship direct to customer

ALTER TABLE products
  ADD COLUMN default_delivery_destination TEXT NOT NULL DEFAULT 'psd_office'
  CHECK (default_delivery_destination IN ('psd_office', 'customer_site'));
