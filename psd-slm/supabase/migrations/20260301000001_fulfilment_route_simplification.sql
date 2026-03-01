-- ============================================================================
-- Fulfilment Route Simplification
-- Migration: 20260301000001_fulfilment_route_simplification
--
-- Old model (3 routes): stock, deliver_to_site, drop_ship
-- New model (2 routes): from_stock, drop_ship
--
-- "from_stock" = PSD delivers to customer (sourcing decision is separate)
-- "drop_ship"  = Supplier ships direct to customer
-- ============================================================================

-- 1. Migrate existing data to new values
UPDATE quote_lines SET fulfilment_route = 'from_stock' WHERE fulfilment_route IN ('stock', 'deliver_to_site');
UPDATE sales_order_lines SET fulfilment_route = 'from_stock' WHERE fulfilment_route IN ('stock', 'deliver_to_site');

-- 2. Update CHECK constraints on quote_lines
ALTER TABLE quote_lines
DROP CONSTRAINT IF EXISTS quote_lines_fulfilment_route_check;

ALTER TABLE quote_lines
ADD CONSTRAINT quote_lines_fulfilment_route_check
CHECK (fulfilment_route IN ('from_stock', 'drop_ship'));

ALTER TABLE quote_lines
ALTER COLUMN fulfilment_route SET DEFAULT 'from_stock';

-- 3. Update CHECK constraints on sales_order_lines
ALTER TABLE sales_order_lines
DROP CONSTRAINT IF EXISTS sales_order_lines_fulfilment_route_check;

ALTER TABLE sales_order_lines
ADD CONSTRAINT sales_order_lines_fulfilment_route_check
CHECK (fulfilment_route IN ('from_stock', 'drop_ship'));

ALTER TABLE sales_order_lines
ALTER COLUMN fulfilment_route SET DEFAULT 'from_stock';
