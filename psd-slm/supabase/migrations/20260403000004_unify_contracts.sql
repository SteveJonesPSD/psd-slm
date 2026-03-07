-- Unify support_contracts into customer_contracts
-- The helpdesk previously used its own support_contracts table.
-- customer_contracts (contracts module) is now the single source of truth.

-- 1. Add SLA and support fields to customer_contracts
ALTER TABLE customer_contracts
    ADD COLUMN IF NOT EXISTS sla_plan_id UUID REFERENCES sla_plans(id),
    ADD COLUMN IF NOT EXISTS monthly_hours NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_customer_contracts_sla ON customer_contracts(sla_plan_id);

-- 2. Add new FK column on tickets pointing to customer_contracts
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS customer_contract_id UUID REFERENCES customer_contracts(id);

CREATE INDEX IF NOT EXISTS idx_tickets_customer_contract ON tickets(customer_contract_id);

-- 3. Update v_ticket_summary to include customer_contract_id
-- (drop and recreate since views can't be altered to add columns)
DROP VIEW IF EXISTS v_ticket_summary;

CREATE VIEW v_ticket_summary AS
SELECT
    t.id,
    t.org_id,
    t.ticket_number,
    t.subject,
    t.description,
    t.status,
    t.priority,
    t.ticket_type,
    t.source,
    t.customer_id,
    c.name AS customer_name,
    t.contact_id,
    CASE WHEN co.id IS NOT NULL THEN co.first_name || ' ' || co.last_name ELSE NULL END AS contact_name,
    t.assigned_to,
    CASE WHEN u.id IS NOT NULL THEN u.first_name || ' ' || u.last_name ELSE NULL END AS assigned_to_name,
    t.category_id,
    cat.name AS category_name,
    t.brand_id,
    t.contract_id,
    t.customer_contract_id,
    t.sla_plan_id,
    t.sla_response_due_at,
    t.sla_resolution_due_at,
    t.sla_response_met,
    t.sla_resolution_met,
    t.tone_score,
    t.tone_trend,
    t.hold_open,
    t.merged_into_ticket_id,
    t.department_id,
    t.created_at,
    t.updated_at,
    t.closed_at,
    t.first_responded_at
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts co ON co.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories cat ON cat.id = t.category_id;
