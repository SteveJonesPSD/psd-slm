-- Add default SLA plan and monthly hours to contract_types
-- so helpdesk SLA configuration lives on the master contract type definition.

ALTER TABLE contract_types
    ADD COLUMN IF NOT EXISTS default_sla_plan_id UUID REFERENCES sla_plans(id),
    ADD COLUMN IF NOT EXISTS default_monthly_hours NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_contract_types_sla ON contract_types(default_sla_plan_id);
