-- =============================================================================
-- Customer Email Domains
-- Purpose-built domain lookup table for inbound email-to-customer matching.
-- Each customer has explicit approved domains; emails from unknown domains
-- are rejected (logged, not silently dropped).
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS customer_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Unique index: one active domain per org (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_email_domains_unique
  ON customer_email_domains (org_id, lower(domain))
  WHERE is_active = true;

-- Lookup index for fast domain matching
CREATE INDEX IF NOT EXISTS idx_customer_email_domains_lookup
  ON customer_email_domains (org_id, lower(domain));

-- FK index for customer cascade
CREATE INDEX IF NOT EXISTS idx_customer_email_domains_customer
  ON customer_email_domains (customer_id);

-- RLS
ALTER TABLE customer_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_email_domains_select ON customer_email_domains
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY customer_email_domains_insert ON customer_email_domains
  FOR INSERT WITH CHECK (
    org_id = auth_org_id()
    AND auth_has_permission('customers', 'edit_all')
  );

CREATE POLICY customer_email_domains_update ON customer_email_domains
  FOR UPDATE USING (
    org_id = auth_org_id()
    AND auth_has_permission('customers', 'edit_all')
  );

CREATE POLICY customer_email_domains_delete ON customer_email_domains
  FOR DELETE USING (
    org_id = auth_org_id()
    AND auth_has_permission('customers', 'edit_all')
  );

-- =============================================================================
-- Add rejection tracking to mail_processing_log
-- =============================================================================

ALTER TABLE mail_processing_log
  ADD COLUMN IF NOT EXISTS messages_rejected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejections JSONB DEFAULT '[]'::jsonb;

-- =============================================================================
-- Seed domains for existing seed customers (idempotent)
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_customer_id UUID;
BEGIN
  -- Get the first org (seed data context)
  SELECT id INTO v_org_id FROM organisations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- Meridian Academy Trust
  SELECT id INTO v_customer_id FROM customers
    WHERE org_id = v_org_id AND name ILIKE '%Meridian Academy%' LIMIT 1;
  IF v_customer_id IS NOT NULL THEN
    INSERT INTO customer_email_domains (org_id, customer_id, domain)
    VALUES (v_org_id, v_customer_id, 'meridianmat.ac.uk')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Northern Health NHS Trust
  SELECT id INTO v_customer_id FROM customers
    WHERE org_id = v_org_id AND name ILIKE '%Northern Health%' LIMIT 1;
  IF v_customer_id IS NOT NULL THEN
    INSERT INTO customer_email_domains (org_id, customer_id, domain)
    VALUES (v_org_id, v_customer_id, 'northernhealth.nhs.uk')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Hartwell Commercial Properties
  SELECT id INTO v_customer_id FROM customers
    WHERE org_id = v_org_id AND name ILIKE '%Hartwell%' LIMIT 1;
  IF v_customer_id IS NOT NULL THEN
    INSERT INTO customer_email_domains (org_id, customer_id, domain)
    VALUES (v_org_id, v_customer_id, 'hartwellprop.co.uk')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Pennine Leisure Group
  SELECT id INTO v_customer_id FROM customers
    WHERE org_id = v_org_id AND name ILIKE '%Pennine%' LIMIT 1;
  IF v_customer_id IS NOT NULL THEN
    INSERT INTO customer_email_domains (org_id, customer_id, domain)
    VALUES (v_org_id, v_customer_id, 'pennineleisure.co.uk')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
