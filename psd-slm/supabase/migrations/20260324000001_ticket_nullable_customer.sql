-- =============================================================================
-- Make tickets.customer_id nullable
-- Allows email-created tickets from unknown senders to land in the queue
-- without being dropped. Manual customer assignment happens afterwards.
-- =============================================================================

-- 1. Drop the NOT NULL constraint on customer_id
ALTER TABLE tickets ALTER COLUMN customer_id DROP NOT NULL;

-- 2. Recreate v_ticket_summary to handle null customer_id gracefully.
--    The view already uses LEFT JOIN so null customer_id produces null customer_name.
--    We just need to re-create it to pick up the latest column set.
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
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;
