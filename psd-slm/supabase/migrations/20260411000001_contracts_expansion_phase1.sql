-- Contracts Expansion Phase 1
-- Extends product types, contract types (service/licensing categories),
-- customer contracts (term, billing, e-sign, rolling), contract lines (pricing),
-- and adds invoice schedule + supplier price stub tables.

-- ============================================================
-- 1. Extend product_type on products
-- ============================================================

-- Drop the existing inline CHECK on product_type
DO $$ DECLARE r RECORD;
BEGIN
    FOR r IN SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'products'::regclass
          AND con.contype = 'c'
          AND att.attname = 'product_type'
    LOOP
        EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE products ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN (
    'goods', 'service',
    'hardware', 'labour', 'consumable', 'software',
    'subscription', 'license', 'warranty'
  ));

-- ============================================================
-- 2. Extend contract_types — new category model + billing fields
-- ============================================================

-- Drop existing inline CHECK on category
DO $$ DECLARE r RECORD;
BEGIN
    FOR r IN SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'contract_types'::regclass
          AND con.contype = 'c'
          AND att.attname = 'category'
    LOOP
        EXECUTE 'ALTER TABLE contract_types DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Migrate existing category values to 'support'
UPDATE contract_types SET category = 'support' WHERE category NOT IN ('support', 'service', 'licensing');

-- Add new CHECK with the three categories
ALTER TABLE contract_types ADD CONSTRAINT contract_types_category_check
  CHECK (category IN ('support', 'service', 'licensing'));

-- Change default
ALTER TABLE contract_types ALTER COLUMN category SET DEFAULT 'support';

-- Add new billing/term columns
ALTER TABLE contract_types
  ADD COLUMN IF NOT EXISTS default_term_months INTEGER,
  ADD COLUMN IF NOT EXISTS default_notice_alert_days INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS secondary_alert_days INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS auto_invoice BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_frequency TEXT DEFAULT 'annual'
    CHECK (invoice_frequency IN ('annual', 'monthly', 'quarterly'));

-- ============================================================
-- 3. Extend customer_contracts
-- ============================================================

-- Make end_date nullable for open-ended contracts
ALTER TABLE customer_contracts ALTER COLUMN end_date DROP NOT NULL;

-- Add new columns
ALTER TABLE customer_contracts
  ADD COLUMN IF NOT EXISTS source_quote_id UUID REFERENCES quotes(id),
  ADD COLUMN IF NOT EXISTS term_months INTEGER,
  ADD COLUMN IF NOT EXISTS go_live_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_schedule_start DATE,
  ADD COLUMN IF NOT EXISTS notice_alert_days INTEGER,
  ADD COLUMN IF NOT EXISTS secondary_alert_days INTEGER,
  ADD COLUMN IF NOT EXISTS auto_invoice BOOLEAN,
  ADD COLUMN IF NOT EXISTS invoice_frequency TEXT
    CHECK (invoice_frequency IN ('annual', 'monthly', 'quarterly')),
  ADD COLUMN IF NOT EXISTS is_rolling BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolling_frequency TEXT
    CHECK (rolling_frequency IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS next_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'active'
    CHECK (renewal_status IN (
      'active', 'alert_180', 'alert_90', 'notice_given',
      'renewal_in_progress', 'rolling', 'superseded', 'expired', 'cancelled'
    )),
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES customer_contracts(id),
  ADD COLUMN IF NOT EXISTS upgrade_go_live_date DATE,
  ADD COLUMN IF NOT EXISTS esign_status TEXT DEFAULT 'not_required'
    CHECK (esign_status IN ('not_required', 'pending', 'signed', 'waived'));

CREATE INDEX IF NOT EXISTS idx_customer_contracts_source_quote ON customer_contracts(source_quote_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_renewal_status ON customer_contracts(org_id, renewal_status);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_end_date ON customer_contracts(org_id, end_date) WHERE end_date IS NOT NULL;

-- ============================================================
-- 4. Extend contract_lines
-- ============================================================

ALTER TABLE contract_lines
  ADD COLUMN IF NOT EXISTS source_quote_line_id UUID REFERENCES quote_lines(id),
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS buy_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS line_type TEXT DEFAULT 'recurring'
    CHECK (line_type IN ('recurring', 'one_off', 'usage'));

-- ============================================================
-- 5. Extend contract_renewals
-- ============================================================

ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS renewal_quote_id UUID REFERENCES quotes(id),
  ADD COLUMN IF NOT EXISTS renewal_workflow_status TEXT DEFAULT 'pending'
    CHECK (renewal_workflow_status IN (
      'pending', 'quote_generated', 'quote_sent',
      'quote_accepted', 'signed', 'completed'
    ));

-- Backfill org_id on existing rows from old_contract_id
UPDATE contract_renewals cr
SET org_id = cc.org_id
FROM customer_contracts cc
WHERE cr.old_contract_id = cc.id
  AND cr.org_id IS NULL;

-- ============================================================
-- 6. New table: contract_invoice_schedule
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_invoice_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id),
  contract_id       UUID NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
  scheduled_date    DATE NOT NULL,
  period_label      TEXT NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  base_amount       NUMERIC(12,2) NOT NULL,
  amount_override   NUMERIC(12,2),
  invoice_id        UUID REFERENCES invoices(id),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'draft_created', 'sent', 'skipped', 'cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_invoice_schedule_contract
  ON contract_invoice_schedule(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoice_schedule_pending
  ON contract_invoice_schedule(org_id, scheduled_date)
  WHERE status = 'pending';

-- ============================================================
-- 7. New table: contract_line_supplier_prices (STUB)
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_line_supplier_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id),
  contract_line_id    UUID NOT NULL REFERENCES contract_lines(id) ON DELETE CASCADE,
  supplier_id         UUID REFERENCES suppliers(id),
  product_id          UUID REFERENCES products(id),
  current_buy_price   NUMERIC(12,2),
  last_checked_at     TIMESTAMPTZ,
  price_source        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_line_supplier_prices_line
  ON contract_line_supplier_prices(contract_line_id);

-- ============================================================
-- 8. Views
-- ============================================================

-- Contracts with pending invoice schedule rows due today or overdue
CREATE OR REPLACE VIEW v_contracts_pending_invoices AS
SELECT
  cc.id AS contract_id,
  cc.org_id,
  cc.contract_number,
  cc.customer_id,
  cu.name AS customer_name,
  cis.id AS schedule_id,
  cis.scheduled_date,
  cis.period_label,
  COALESCE(cis.amount_override, cis.base_amount) AS effective_amount
FROM contract_invoice_schedule cis
JOIN customer_contracts cc ON cc.id = cis.contract_id
JOIN customers cu ON cu.id = cc.customer_id
WHERE cis.status = 'pending'
  AND cis.scheduled_date <= CURRENT_DATE;

-- Contracts expiring within their alert thresholds
CREATE OR REPLACE VIEW v_contracts_expiring_soon AS
SELECT
  cc.*,
  cu.name AS customer_name,
  ct.name AS contract_type_name,
  ct.category,
  (cc.end_date - CURRENT_DATE) AS days_remaining,
  CASE
    WHEN (cc.end_date - CURRENT_DATE) <= COALESCE(cc.secondary_alert_days, ct.secondary_alert_days, 90) THEN 'alert_90'
    WHEN (cc.end_date - CURRENT_DATE) <= COALESCE(cc.notice_alert_days, ct.default_notice_alert_days, 180) THEN 'alert_180'
  END AS alert_level
FROM customer_contracts cc
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
WHERE cc.end_date IS NOT NULL
  AND cc.renewal_status IN ('active', 'alert_180', 'alert_90')
  AND (cc.end_date - CURRENT_DATE) <= COALESCE(cc.notice_alert_days, ct.default_notice_alert_days, 180)
  AND ct.category IN ('service', 'licensing');

-- Full invoice schedule with contract and customer details
CREATE OR REPLACE VIEW v_contract_invoice_schedule AS
SELECT
  cis.*,
  COALESCE(cis.amount_override, cis.base_amount) AS effective_amount,
  cc.contract_number,
  cc.customer_id,
  cu.name AS customer_name,
  ct.category,
  inv.invoice_number,
  inv.status AS invoice_status
FROM contract_invoice_schedule cis
JOIN customer_contracts cc ON cc.id = cis.contract_id
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
LEFT JOIN invoices inv ON inv.id = cis.invoice_id;

-- Licensing contracts in renewal pipeline
CREATE OR REPLACE VIEW v_licensing_renewal_pipeline AS
SELECT
  cc.id AS contract_id,
  cc.contract_number,
  cc.customer_id,
  cu.name AS customer_name,
  cc.end_date,
  (cc.end_date - CURRENT_DATE) AS days_remaining,
  cr.id AS renewal_id,
  cr.renewal_quote_id,
  cr.renewal_workflow_status,
  q.quote_number AS renewal_quote_number,
  q.status AS renewal_quote_status
FROM customer_contracts cc
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
LEFT JOIN contract_renewals cr ON cr.old_contract_id = cc.id
  AND cr.renewal_workflow_status NOT IN ('completed')
LEFT JOIN quotes q ON q.id = cr.renewal_quote_id
WHERE ct.category = 'licensing'
  AND cc.renewal_status IN ('alert_180', 'alert_90', 'renewal_in_progress');

-- Rolling contracts
CREATE OR REPLACE VIEW v_contracts_rolling AS
SELECT
  cc.*,
  cu.name AS customer_name,
  ct.name AS contract_type_name
FROM customer_contracts cc
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
WHERE cc.is_rolling = true
  AND cc.renewal_status = 'rolling';

-- ============================================================
-- 9. RLS policies for new tables
-- ============================================================

ALTER TABLE contract_invoice_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_invoice_schedule_select" ON contract_invoice_schedule FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "contract_invoice_schedule_insert" ON contract_invoice_schedule FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "contract_invoice_schedule_update" ON contract_invoice_schedule FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "contract_invoice_schedule_delete" ON contract_invoice_schedule FOR DELETE
  USING (org_id = auth_org_id());

ALTER TABLE contract_line_supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_line_supplier_prices_select" ON contract_line_supplier_prices FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "contract_line_supplier_prices_insert" ON contract_line_supplier_prices FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "contract_line_supplier_prices_update" ON contract_line_supplier_prices FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "contract_line_supplier_prices_delete" ON contract_line_supplier_prices FOR DELETE
  USING (org_id = auth_org_id());
