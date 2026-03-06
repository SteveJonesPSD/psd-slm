-- Activity types (configurable by admin)
CREATE TABLE activity_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  background TEXT NOT NULL DEFAULT '#f3f4f6',
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX idx_activity_types_org ON activity_types(org_id);

-- Activities (non-job schedule entries)
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  activity_type_id UUID NOT NULL REFERENCES activity_types(id),
  engineer_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  all_day BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_org ON activities(org_id);
CREATE INDEX idx_activities_engineer_date ON activities(engineer_id, scheduled_date);
CREATE INDEX idx_activities_org_date ON activities(org_id, scheduled_date);

-- RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_types_org ON activity_types
  USING (org_id = auth_org_id());

CREATE POLICY activities_org ON activities
  USING (org_id = auth_org_id());
