-- Add default_route to products
-- Determines the default fulfilment route when this product is added to a quote
-- from_stock = ship from PSD warehouse, drop_ship = ship direct from supplier

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS default_route TEXT NOT NULL DEFAULT 'from_stock'
  CHECK (default_route IN ('from_stock', 'drop_ship'));

-- Backfill: products that default to customer_site delivery should default to drop_ship route
UPDATE products
SET default_route = 'drop_ship'
WHERE default_delivery_destination = 'customer_site';
