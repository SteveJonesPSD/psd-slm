-- Quote Versioning & Revision Workflow
-- Adds base_quote_number for grouping version families,
-- status_before_revised for reactivation support,
-- and 'revised' status.

-- Step 1: Add new columns
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS base_quote_number TEXT,
  ADD COLUMN IF NOT EXISTS status_before_revised TEXT;

-- Step 2: Backfill base_quote_number from existing quote_number
UPDATE quotes SET base_quote_number = quote_number WHERE base_quote_number IS NULL;

-- Step 3: Set NOT NULL with a DEFAULT so inserts without base_quote_number don't fail
-- (protects against code/schema deploy ordering mismatches)
ALTER TABLE quotes ALTER COLUMN base_quote_number SET DEFAULT '';
ALTER TABLE quotes ALTER COLUMN base_quote_number SET NOT NULL;

-- Step 4: Trigger to auto-populate base_quote_number from quote_number when not provided
CREATE OR REPLACE FUNCTION set_base_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.base_quote_number IS NULL OR NEW.base_quote_number = '' THEN
    NEW.base_quote_number := NEW.quote_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_base_quote_number ON quotes;
CREATE TRIGGER trg_set_base_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_base_quote_number();

-- Step 5: Drop existing status check constraint and recreate with 'revised'
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'review', 'sent', 'accepted', 'declined', 'expired', 'superseded', 'revised'));

-- Step 6: Index for version family lookups
CREATE INDEX IF NOT EXISTS idx_quotes_base_quote_number ON quotes (base_quote_number);

-- Step 7: Fix v_active_deal_pricing view — add deal_reg_line_id (drl.id)
-- The FK quote_lines.deal_reg_line_id references deal_registration_lines.id,
-- but the view previously only exposed deal_registrations.id as deal_reg_id.
DROP VIEW IF EXISTS v_active_deal_pricing;
CREATE VIEW v_active_deal_pricing AS
SELECT
  dr.id AS deal_reg_id,
  drl.id AS deal_reg_line_id,
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

-- Step 8: Fix notifications RLS policies
-- The original policies compared user_id = auth.uid(), but user_id stores
-- the app-level users.id UUID while auth.uid() returns the Supabase Auth UID
-- (stored as users.auth_id). Fix by resolving through the users table.

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
);
