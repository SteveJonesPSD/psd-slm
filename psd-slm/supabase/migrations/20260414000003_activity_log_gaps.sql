-- Ensure activity_log has indexes needed for the audit UI filtering
-- These are additive — do not alter existing columns

CREATE INDEX IF NOT EXISTS idx_activity_log_org_created
  ON activity_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log(org_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type
  ON activity_log(org_id, entity_type, created_at DESC);
