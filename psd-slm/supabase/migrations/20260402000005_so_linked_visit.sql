-- Link a sales order to a visit instance (site visit)
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS linked_visit_instance_id UUID REFERENCES visit_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_linked_visit ON sales_orders(linked_visit_instance_id)
  WHERE linked_visit_instance_id IS NOT NULL;
