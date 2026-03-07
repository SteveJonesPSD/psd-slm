-- Multi-Calendar Support
-- Allow multiple active calendars simultaneously and assign calendars to contracts.
-- This supports orgs with customers on different schedule lengths (e.g. 36-week vs 39-week).

-- ============================================================
-- Add calendar_id to customer_contracts
-- ============================================================
ALTER TABLE customer_contracts
    ADD COLUMN calendar_id UUID REFERENCES visit_calendars(id) ON DELETE SET NULL;

CREATE INDEX idx_customer_contracts_calendar ON customer_contracts(calendar_id);

COMMENT ON COLUMN customer_contracts.calendar_id IS 'Visit calendar assigned to this contract. Determines which academic year schedule is used for visit generation.';

-- ============================================================
-- Update v_contract_visit_slots to include calendar_id
-- ============================================================
DROP VIEW IF EXISTS v_contract_visit_slots;
CREATE VIEW v_contract_visit_slots AS
SELECT
    cvs.id,
    cvs.customer_contract_id,
    cc.contract_number,
    cc.customer_id,
    cu.name AS customer_name,
    ct.name AS contract_type_name,
    ct.code AS contract_type_code,
    cc.calendar_id,
    cvs.engineer_id,
    u.first_name || ' ' || u.last_name AS engineer_name,
    cvs.cycle_week_numbers,
    cvs.day_of_week,
    cvs.time_slot,
    COALESCE(cvs.override_start_time, cvs.default_start_time) AS effective_start_time,
    COALESCE(cvs.override_end_time, cvs.default_end_time) AS effective_end_time,
    cvs.notes,
    cvs.sort_order
FROM contract_visit_slots cvs
JOIN customer_contracts cc ON cc.id = cvs.customer_contract_id
JOIN customers cu ON cu.id = cc.customer_id
JOIN contract_types ct ON ct.id = cc.contract_type_id
JOIN users u ON u.id = cvs.engineer_id
WHERE cc.status = 'active';
