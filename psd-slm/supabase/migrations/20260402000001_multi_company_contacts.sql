-- =============================================================================
-- Multi-Company Contacts & Enhanced Email Routing
-- Junction table for contacts linked to multiple customers.
-- Assignment tracking columns on tickets for unmatched senders.
-- email_domain companion column on contacts for domain-based lookup.
-- =============================================================================

-- 1. Contact-Customer Links (junction table)
CREATE TABLE IF NOT EXISTS contact_customer_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organisations(id),
    is_primary      BOOLEAN DEFAULT false,
    role            TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(contact_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_ccl_contact ON contact_customer_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_ccl_customer ON contact_customer_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_ccl_org ON contact_customer_links(org_id);

-- RLS
ALTER TABLE contact_customer_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccl_select ON contact_customer_links
    FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY ccl_insert ON contact_customer_links
    FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY ccl_update ON contact_customer_links
    FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY ccl_delete ON contact_customer_links
    FOR DELETE USING (org_id = auth_org_id());

-- 2. Assignment tracking columns on tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS needs_customer_assignment BOOLEAN DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_assignment_options JSONB;

-- 3. email_domain companion column on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_domain TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_email_domain ON contacts(email_domain);

-- Backfill email_domain from existing email values
UPDATE contacts SET email_domain = LOWER(SPLIT_PART(email, '@', 2))
WHERE email IS NOT NULL AND email LIKE '%@%' AND email_domain IS NULL;

-- 4. Update v_ticket_summary to include needs_customer_assignment
DROP VIEW IF EXISTS v_ticket_summary;
CREATE VIEW v_ticket_summary AS
SELECT
  t.id,
  t.org_id,
  t.ticket_number,
  t.subject,
  t.status,
  t.priority,
  t.ticket_type,
  t.created_at,
  t.updated_at,
  t.sla_response_due_at,
  t.sla_resolution_due_at,
  t.first_responded_at,
  t.resolved_at,
  t.sla_response_met,
  t.sla_resolution_met,
  t.escalation_level,
  c.id AS customer_id,
  c.name AS customer_name,
  ct.id AS contact_id,
  ct.first_name || ' ' || ct.last_name AS contact_name,
  u.id AS assigned_to_id,
  u.first_name || ' ' || u.last_name AS assigned_to_name,
  u.initials AS assigned_to_initials,
  u.color AS assigned_to_color,
  tc.name AS category_name,
  b.name AS brand_name,
  t.brand_id,
  t.category_id,
  t.contract_id,
  t.assigned_to,
  t.created_by,
  t.merged_into_ticket_id,
  t.tone_score,
  t.tone_trend,
  t.tone_summary,
  t.tone_updated_at,
  t.source,
  t.needs_customer_assignment,
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes,
  -- customer_waiting: true if the latest non-internal message is from customer
  (SELECT tm2.sender_type = 'customer' FROM ticket_messages tm2 WHERE tm2.ticket_id = t.id AND NOT tm2.is_internal ORDER BY tm2.created_at DESC LIMIT 1) AS customer_waiting
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;

-- 5. Backfill junction table from existing contacts.customer_id
INSERT INTO contact_customer_links (contact_id, customer_id, org_id, is_primary)
SELECT c.id, c.customer_id, cu.org_id, true
FROM contacts c
JOIN customers cu ON cu.id = c.customer_id
WHERE c.customer_id IS NOT NULL
ON CONFLICT (contact_id, customer_id) DO NOTHING;

-- 6. Helper view: all contacts for a customer (direct + linked)
CREATE OR REPLACE VIEW v_customer_all_contacts AS
SELECT c.*, cu.id AS linked_customer_id, true AS is_primary_link
FROM contacts c
JOIN customers cu ON cu.id = c.customer_id
UNION ALL
SELECT c.*, ccl.customer_id AS linked_customer_id, ccl.is_primary AS is_primary_link
FROM contacts c
JOIN contact_customer_links ccl ON ccl.contact_id = c.id
WHERE ccl.customer_id != c.customer_id;

-- 7. Org setting for domain rejection behaviour (default: accept unknown)
INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT id, 'email', 'email_reject_unknown_domains', 'false'
FROM organisations
ON CONFLICT DO NOTHING;
