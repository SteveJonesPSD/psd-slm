-- ============================================================================
-- TEAMS & TEAM MEMBERS
-- ============================================================================
-- Teams allow grouping users (e.g. Infrastructure, Engineering).
-- Used by the scheduling module to filter which users appear on the dispatch
-- calendar, and available for future module-level filtering.

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  color       text DEFAULT '#6366f1',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- Team members join table
CREATE TABLE IF NOT EXISTS team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_teams_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams: org-scoped read
CREATE POLICY teams_select ON teams
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
  );

-- Teams: admin-only write
CREATE POLICY teams_insert ON teams
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY teams_update ON teams
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY teams_delete ON teams
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
    )
  );

-- Team members: read if you can see the team
CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN users u ON u.org_id = t.org_id
      WHERE t.id = team_members.team_id
      AND u.auth_id = auth.uid()
    )
  );

-- Team members: admin write
CREATE POLICY team_members_insert ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN users u ON u.org_id = t.org_id
      JOIN roles r ON r.id = u.role_id
      WHERE t.id = team_members.team_id
      AND u.auth_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY team_members_delete ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN users u ON u.org_id = t.org_id
      JOIN roles r ON r.id = u.role_id
      WHERE t.id = team_members.team_id
      AND u.auth_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
    )
  );
