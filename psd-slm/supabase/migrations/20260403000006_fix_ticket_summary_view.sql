-- Fix v_ticket_summary: the unify_contracts migration (20260403000004) recreated
-- the view but dropped many columns (initials, color, brand, tone, counts, etc).
-- This restores the full view with all required columns.

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
  t.customer_contract_id,
  t.sla_plan_id,
  t.assigned_to,
  t.created_by,
  t.merged_into_ticket_id,
  t.hold_open,
  t.department_id,
  t.tone_score,
  t.tone_trend,
  t.tone_summary,
  t.tone_updated_at,
  t.source,
  t.needs_customer_assignment,
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes,
  (SELECT tm2.sender_type = 'customer' FROM ticket_messages tm2 WHERE tm2.ticket_id = t.id AND NOT tm2.is_internal ORDER BY tm2.created_at DESC LIMIT 1) AS customer_waiting
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;
