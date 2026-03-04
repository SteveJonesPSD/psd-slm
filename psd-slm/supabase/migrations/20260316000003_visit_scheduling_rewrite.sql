-- Visit Scheduling Rewrite
-- Patterns now live on contract_visit_slots (contracts module).
-- This migration removes visit_slot_templates and updates visit_instances
-- to reference contract_visit_slots instead.

-- ============================================================
-- Drop the old view that depends on visit_slot_templates
-- ============================================================
DROP VIEW IF EXISTS v_slot_templates_overview CASCADE;

-- ============================================================
-- Rename visit_instances.slot_template_id → contract_visit_slot_id
-- ============================================================
ALTER TABLE visit_instances
    RENAME COLUMN slot_template_id TO contract_visit_slot_id;

-- Drop old index on the renamed column
DROP INDEX IF EXISTS idx_visit_instances_template;

-- Update the FK constraint: drop old, add new
ALTER TABLE visit_instances
    DROP CONSTRAINT IF EXISTS visit_instances_slot_template_id_fkey;

-- Null out stale references — old values pointed at visit_slot_templates rows
UPDATE visit_instances SET contract_visit_slot_id = NULL
WHERE contract_visit_slot_id IS NOT NULL;

ALTER TABLE visit_instances
    ADD CONSTRAINT visit_instances_contract_visit_slot_id_fkey
    FOREIGN KEY (contract_visit_slot_id)
    REFERENCES contract_visit_slots(id)
    ON DELETE SET NULL;

-- New index for contract_visit_slot_id
CREATE INDEX idx_visit_instances_contract_visit_slot
    ON visit_instances(contract_visit_slot_id);

-- ============================================================
-- Drop visit_slot_templates table (and its RLS policies, indexes)
-- ============================================================
DROP TABLE IF EXISTS visit_slot_templates CASCADE;

-- ============================================================
-- Rebuild v_engineer_schedule to reference contract_visit_slots
-- ============================================================
DROP VIEW IF EXISTS v_engineer_schedule CASCADE;

CREATE VIEW v_engineer_schedule AS
SELECT
    vi.id,
    vi.visit_date,
    vi.time_slot,
    vi.start_time,
    vi.end_time,
    vi.status,
    vi.cycle_week_number,
    vi.engineer_id,
    u.first_name || ' ' || u.last_name AS engineer_name,
    u.color AS engineer_color,
    vi.customer_id,
    c.name AS customer_name,
    vi.customer_contract_id,
    cc.contract_number,
    vi.calendar_id,
    vi.is_bank_holiday,
    vi.notes,
    vi.org_id
FROM visit_instances vi
JOIN users u ON u.id = vi.engineer_id
JOIN customers c ON c.id = vi.customer_id
LEFT JOIN customer_contracts cc ON cc.id = vi.customer_contract_id
WHERE vi.status NOT IN ('cancelled');
