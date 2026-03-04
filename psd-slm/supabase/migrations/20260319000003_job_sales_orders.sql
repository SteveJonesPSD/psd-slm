-- Junction table: many-to-many link between jobs and sales orders
-- A job can be linked to multiple SOs (e.g. visit job with install items)
-- An SO can be linked to multiple jobs (uncommon but possible)

CREATE TABLE IF NOT EXISTS job_sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, sales_order_id)
);

CREATE INDEX idx_jso_job ON job_sales_orders(job_id);
CREATE INDEX idx_jso_so ON job_sales_orders(sales_order_id);

ALTER TABLE job_sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_sales_orders_select" ON job_sales_orders
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "job_sales_orders_insert" ON job_sales_orders
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "job_sales_orders_delete" ON job_sales_orders
  FOR DELETE USING (org_id = auth_org_id());
