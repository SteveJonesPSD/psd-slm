-- AutoGRUMP™ — Customer Tone Monitoring
-- Adds frustration scoring columns to tickets table

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS tone_score INTEGER CHECK (tone_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS tone_trend TEXT CHECK (tone_trend IN ('escalating', 'stable', 'improving', 'new')),
  ADD COLUMN IF NOT EXISTS tone_summary TEXT,
  ADD COLUMN IF NOT EXISTS tone_updated_at TIMESTAMPTZ;

-- Index for filtering/sorting by frustrated tickets
CREATE INDEX IF NOT EXISTS idx_tickets_tone_score ON tickets(org_id, tone_score)
  WHERE tone_score IS NOT NULL AND tone_score >= 3;

COMMENT ON COLUMN tickets.tone_score IS 'AutoGRUMP frustration score: 1=happy, 2=neutral, 3=mildly frustrated, 4=frustrated, 5=angry';
COMMENT ON COLUMN tickets.tone_trend IS 'Direction of tone change across recent messages';
COMMENT ON COLUMN tickets.tone_summary IS 'AI-generated one-line summary of customer tone';

-- Update v_ticket_summary to include tone columns
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
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;
