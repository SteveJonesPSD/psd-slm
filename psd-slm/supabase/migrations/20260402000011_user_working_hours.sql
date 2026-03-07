-- Individual working hours per user per day
-- Overrides org-level working_day_start/working_day_end and scheduling_working_days
-- If no row exists for a user+day, org defaults apply

CREATE TABLE user_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon ... 7=Sun (ISO)
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,  -- null = use org default; ignored when is_working_day = false
  end_time TIME,    -- null = use org default; ignored when is_working_day = false
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

CREATE INDEX idx_user_working_hours_user ON user_working_hours(user_id);
CREATE INDEX idx_user_working_hours_org ON user_working_hours(org_id);

-- RLS
ALTER TABLE user_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_working_hours_select" ON user_working_hours
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "user_working_hours_insert" ON user_working_hours
  FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY "user_working_hours_update" ON user_working_hours
  FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY "user_working_hours_delete" ON user_working_hours
  FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));
