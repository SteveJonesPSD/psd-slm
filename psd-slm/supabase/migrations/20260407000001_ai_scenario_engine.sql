-- AI Scenario Engine
-- Scenarios are org-scoped, channel-agnostic (apply to all non-helpdesk channels)

CREATE TABLE ai_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  agent_id        TEXT NOT NULL CHECK (agent_id IN ('helen', 'jasper', 'lucia')),
  trigger_prompt  TEXT NOT NULL,
  action_prompt   TEXT NOT NULL,
  guardrails      JSONB NOT NULL DEFAULT '{
    "known_contacts_only": true,
    "max_per_sender_per_day": 5,
    "business_hours_only": false,
    "dry_run": false,
    "escalate_to_helpdesk_on_failure": true
  }'::jsonb,
  priority        INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_scenario_executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  scenario_id         UUID REFERENCES ai_scenarios(id) ON DELETE SET NULL,
  scenario_name       TEXT NOT NULL,
  agent_id            TEXT NOT NULL,
  channel_id          UUID REFERENCES mail_channels(id) ON DELETE SET NULL,
  channel_name        TEXT,
  mailbox_address     TEXT,
  sender_email        TEXT NOT NULL,
  sender_name         TEXT,
  customer_name       TEXT,
  email_subject       TEXT NOT NULL,
  email_preview       TEXT,
  email_message_id    TEXT,
  match_rationale     TEXT,
  actions_taken       JSONB,
  response_subject    TEXT,
  response_preview    TEXT,
  response_sent       BOOLEAN NOT NULL DEFAULT false,
  dry_run             BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL CHECK (status IN (
    'matched',
    'dry_run',
    'no_match',
    'guardrail_blocked',
    'escalated',
    'error'
  )),
  error_detail        TEXT,
  executed_at         TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_scenarios_org ON ai_scenarios(org_id);
CREATE INDEX idx_ai_scenarios_active ON ai_scenarios(org_id, is_active, priority);
CREATE INDEX idx_ai_scenario_executions_org ON ai_scenario_executions(org_id, executed_at DESC);
CREATE INDEX idx_ai_scenario_executions_scenario ON ai_scenario_executions(scenario_id, executed_at DESC);
CREATE INDEX idx_ai_scenario_executions_sender ON ai_scenario_executions(org_id, sender_email, executed_at DESC);

-- RLS
ALTER TABLE ai_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scenario_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON ai_scenarios
  FOR ALL USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "org_isolation" ON ai_scenario_executions
  FOR ALL USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_scenarios_updated_at
  BEFORE UPDATE ON ai_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_ai_scenarios_updated_at();
