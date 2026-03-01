-- Migration: Rename companies → customers, add customer_type, dfe_number, create gias_schools
-- Run this against Supabase SQL Editor

BEGIN;

-- 1. Rename companies table to customers
ALTER TABLE companies RENAME TO customers;

-- 2. Add new columns to customers
ALTER TABLE customers ADD COLUMN customer_type TEXT CHECK (customer_type IN ('education', 'business', 'charity'));
ALTER TABLE customers ADD COLUMN dfe_number TEXT;

-- 3. Rename company_id → customer_id in foreign key tables
ALTER TABLE contacts RENAME COLUMN company_id TO customer_id;
ALTER TABLE deal_registrations RENAME COLUMN company_id TO customer_id;
ALTER TABLE opportunities RENAME COLUMN company_id TO customer_id;
ALTER TABLE quotes RENAME COLUMN company_id TO customer_id;
ALTER TABLE sales_orders RENAME COLUMN company_id TO customer_id;
ALTER TABLE invoices RENAME COLUMN company_id TO customer_id;

-- 4. Update indexes (drop old, create new)
DROP INDEX IF EXISTS idx_companies_org_id;
CREATE INDEX idx_customers_org_id ON customers(org_id);

DROP INDEX IF EXISTS idx_contacts_company_id;
CREATE INDEX idx_contacts_customer_id ON contacts(customer_id);

DROP INDEX IF EXISTS idx_deal_registrations_company_id;
CREATE INDEX idx_deal_registrations_customer_id ON deal_registrations(customer_id);

DROP INDEX IF EXISTS idx_opportunities_company_id;
CREATE INDEX idx_opportunities_customer_id ON opportunities(customer_id);

DROP INDEX IF EXISTS idx_quotes_company_id;
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);

DROP INDEX IF EXISTS idx_sales_orders_company_id;
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);

DROP INDEX IF EXISTS idx_invoices_company_id;
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);

-- 5. Recreate views with new names
DROP VIEW IF EXISTS v_margin_traceability;
CREATE VIEW v_margin_traceability AS
SELECT
  ql.id AS quote_line_id,
  q.quote_number,
  c.id AS customer_id,
  c.name AS customer_name,
  sol.id AS so_line_id,
  so.so_number,
  pol.id AS po_line_id,
  po.po_number,
  il.id AS invoice_line_id,
  inv.invoice_number,
  ql.description,
  ql.quantity,
  ql.buy_price AS quoted_buy,
  ql.sell_price AS quoted_sell,
  sol.buy_price AS ordered_buy,
  sol.sell_price AS ordered_sell,
  pol.unit_cost AS actual_cost,
  il.unit_price AS invoiced_sell,
  il.unit_cost AS invoiced_cost,
  CASE WHEN il.id IS NOT NULL THEN (il.unit_price - il.unit_cost) * il.quantity ELSE NULL END AS actual_margin,
  CASE WHEN il.id IS NOT NULL AND il.unit_price > 0 THEN ROUND(((il.unit_price - il.unit_cost) / il.unit_price * 100)::numeric, 1) ELSE NULL END AS margin_pct,
  dr.reference AS deal_reg_ref,
  dr.title AS deal_reg_title
FROM quote_lines ql
JOIN quotes q ON q.id = ql.quote_id
JOIN customers c ON c.id = q.customer_id
LEFT JOIN sales_order_lines sol ON sol.quote_line_id = ql.id
LEFT JOIN sales_orders so ON so.id = sol.sales_order_id
LEFT JOIN purchase_order_lines pol ON pol.sales_order_line_id = sol.id
LEFT JOIN purchase_orders po ON po.id = pol.purchase_order_id
LEFT JOIN invoice_lines il ON il.sales_order_line_id = sol.id
LEFT JOIN invoices inv ON inv.id = il.invoice_id
LEFT JOIN deal_registration_lines drl ON drl.id = ql.deal_reg_line_id
LEFT JOIN deal_registrations dr ON dr.id = drl.deal_reg_id;

DROP VIEW IF EXISTS v_active_deal_pricing;
CREATE VIEW v_active_deal_pricing AS
SELECT
  dr.id AS deal_reg_id,
  c.id AS customer_id,
  c.name AS customer_name,
  s.id AS supplier_id,
  s.name AS supplier_name,
  dr.reference,
  dr.title,
  dr.expiry_date,
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  ps.standard_cost,
  drl.registered_buy_price AS deal_cost,
  ps.standard_cost - drl.registered_buy_price AS saving_per_unit,
  drl.max_quantity
FROM deal_registrations dr
JOIN customers c ON c.id = dr.customer_id
JOIN deal_registration_lines drl ON drl.deal_reg_id = dr.id
JOIN products p ON p.id = drl.product_id
LEFT JOIN suppliers s ON s.id = dr.supplier_id
LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.supplier_id = s.id AND ps.is_preferred = true
WHERE dr.status = 'active'
  AND (dr.expiry_date IS NULL OR dr.expiry_date > CURRENT_DATE);

-- 6. Create GIAS schools lookup table
CREATE TABLE gias_schools (
  urn TEXT PRIMARY KEY,
  establishment_name TEXT NOT NULL,
  street TEXT,
  locality TEXT,
  address3 TEXT,
  town TEXT,
  county TEXT,
  postcode TEXT,
  phone TEXT,
  website TEXT,
  head_first_name TEXT,
  head_last_name TEXT,
  head_title TEXT,
  type_of_establishment TEXT,
  phase_of_education TEXT,
  la_code TEXT,
  la_name TEXT,
  establishment_number TEXT,
  status TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gias_dfe ON gias_schools(la_code, establishment_number);
CREATE INDEX idx_gias_name ON gias_schools(establishment_name);

-- 7. Enable RLS on gias_schools (public read)
ALTER TABLE gias_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on gias_schools" ON gias_schools FOR SELECT USING (true);

COMMIT;
