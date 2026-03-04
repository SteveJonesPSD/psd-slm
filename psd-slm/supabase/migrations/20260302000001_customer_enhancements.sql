-- Customer enhancements: Xero reference + unique indexes for account_number and xero_reference

-- Add xero_reference column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS xero_reference TEXT;

-- Unique index on account_number per org (partial — only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_account_number
  ON customers (org_id, account_number)
  WHERE account_number IS NOT NULL;

-- Unique index on xero_reference per org (partial — only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_xero_reference
  ON customers (org_id, xero_reference)
  WHERE xero_reference IS NOT NULL;
