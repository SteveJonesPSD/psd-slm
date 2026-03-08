-- Add buy_price to pricebook lines and source_pricebook_line_id FK to contract_lines

-- 1. Add buy_price to pricebook template lines
ALTER TABLE contract_type_pricebook_lines
  ADD COLUMN IF NOT EXISTS buy_price NUMERIC(12,2);

-- 2. Add source_pricebook_line_id FK to contract_lines
-- (buy_price already exists from contracts_expansion_phase1 migration)
ALTER TABLE contract_lines
  ADD COLUMN IF NOT EXISTS source_pricebook_line_id UUID
    REFERENCES contract_type_pricebook_lines(id) ON DELETE SET NULL;
