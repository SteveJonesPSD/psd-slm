-- Add product_type column to distinguish goods from services
ALTER TABLE products
ADD COLUMN product_type TEXT NOT NULL DEFAULT 'goods'
CHECK (product_type IN ('goods', 'service'));

CREATE INDEX idx_products_type ON products(org_id, product_type);

COMMENT ON COLUMN products.product_type IS
'goods = physical item (full lifecycle: stock, serialisation, POs). service = non-tangible (quote/invoice line only, no stock/serial/PO).';
