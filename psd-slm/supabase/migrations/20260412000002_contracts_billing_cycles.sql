-- Contracts Expansion: Billing Cycles & Pricebook
-- Adds billing_cycle_type to contract_types and customer_contracts,
-- billing_month/billing_day to customer_contracts,
-- pro-rata fields to contract_invoice_schedule,
-- and contract_type_pricebook_lines table.

-- ============================================================
-- 1. Extend contract_types with billing_cycle_type
-- ============================================================

ALTER TABLE contract_types
  ADD COLUMN IF NOT EXISTS billing_cycle_type TEXT DEFAULT 'go_live_date'
    CHECK (billing_cycle_type IN ('fixed_date', 'start_date', 'go_live_date')),
  ADD COLUMN IF NOT EXISTS default_billing_month INTEGER;

-- ============================================================
-- 2. Extend customer_contracts with billing fields
-- ============================================================

ALTER TABLE customer_contracts
  ADD COLUMN IF NOT EXISTS billing_cycle_type TEXT
    CHECK (billing_cycle_type IN ('fixed_date', 'start_date', 'go_live_date')),
  ADD COLUMN IF NOT EXISTS billing_month INTEGER,
  ADD COLUMN IF NOT EXISTS billing_day INTEGER DEFAULT 1;

-- ============================================================
-- 3. Add pro-rata tracking to contract_invoice_schedule
-- ============================================================

ALTER TABLE contract_invoice_schedule
  ADD COLUMN IF NOT EXISTS is_prorata BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS prorata_days INTEGER,
  ADD COLUMN IF NOT EXISTS prorata_total_days INTEGER;

-- ============================================================
-- 4. New table: contract_type_pricebook_lines
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_type_pricebook_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id),
  contract_type_id  UUID NOT NULL REFERENCES contract_types(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  annual_price      NUMERIC(12,2) NOT NULL,
  buy_price         NUMERIC(12,2),
  vat_rate          NUMERIC(5,2) DEFAULT 20.00,
  sort_order        INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricebook_lines_type
  ON contract_type_pricebook_lines(contract_type_id);

ALTER TABLE contract_type_pricebook_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricebook_lines_select" ON contract_type_pricebook_lines FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "pricebook_lines_insert" ON contract_type_pricebook_lines FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "pricebook_lines_update" ON contract_type_pricebook_lines FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "pricebook_lines_delete" ON contract_type_pricebook_lines FOR DELETE
  USING (org_id = auth_org_id());

-- ============================================================
-- 5. Set billing_cycle_type defaults on existing support types
-- ============================================================

-- ProFlex types (ICT) use fixed_date by default
UPDATE contract_types
SET billing_cycle_type = 'fixed_date',
    default_billing_month = 4
WHERE category = 'support'
  AND code LIKE 'proflex%'
  AND billing_cycle_type IS NULL;

-- AC/CCTV maintenance types use start_date
UPDATE contract_types
SET billing_cycle_type = 'start_date'
WHERE category = 'support'
  AND (code LIKE 'ac%' OR code LIKE 'cctv%')
  AND billing_cycle_type IS NULL;

-- Service/Licensing always use go_live_date
UPDATE contract_types
SET billing_cycle_type = 'go_live_date'
WHERE category IN ('service', 'licensing')
  AND billing_cycle_type IS NULL;
