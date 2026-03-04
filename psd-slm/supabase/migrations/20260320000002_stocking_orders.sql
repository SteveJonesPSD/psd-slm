-- Stocking Orders & Auto-Allocate on PO Receipt
-- Makes sales_order_id nullable to support POs raised without an SO (stock replenishment).
-- Adds purchase_type column to distinguish customer orders from stock orders.

-- 1. Make sales_order_id nullable on purchase_orders
ALTER TABLE purchase_orders
    ALTER COLUMN sales_order_id DROP NOT NULL;

-- 2. Make sales_order_line_id nullable on purchase_order_lines
ALTER TABLE purchase_order_lines
    ALTER COLUMN sales_order_line_id DROP NOT NULL;

-- 3. Add purchase_type to purchase_orders
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS purchase_type TEXT NOT NULL DEFAULT 'customer_order'
    CHECK (purchase_type IN ('customer_order', 'stock_order'));

-- 4. All existing POs are customer orders (safe — sales_order_id was NOT NULL before)
UPDATE purchase_orders
SET purchase_type = 'customer_order'
WHERE purchase_type IS NULL;

-- 5. Index for filtering by purchase type
CREATE INDEX IF NOT EXISTS idx_po_purchase_type ON purchase_orders(org_id, purchase_type);

-- 6. Index for stock orders (no SO link)
CREATE INDEX IF NOT EXISTS idx_po_stock_orders ON purchase_orders(org_id)
    WHERE sales_order_id IS NULL;
