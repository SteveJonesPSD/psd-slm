-- ============================================================================
-- Onsite Scheduling — Dispatch calendar, job management, field engineer views
-- Migration: 20260304000001_onsite_scheduling
-- ============================================================================

-- 1. Job types (seeded with defaults)
CREATE TABLE job_types (
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

CREATE INDEX idx_job_types_org ON job_types(org_id);

-- 2. Jobs (main table)
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),

  -- Identification
  job_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Customer & site
  company_id UUID NOT NULL REFERENCES customers(id),
  contact_id UUID REFERENCES contacts(id),
  site_address_line1 TEXT,
  site_address_line2 TEXT,
  site_city TEXT,
  site_county TEXT,
  site_postcode TEXT,

  -- Classification
  job_type_id UUID NOT NULL REFERENCES job_types(id),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'unscheduled' CHECK (status IN (
    'unscheduled', 'scheduled', 'travelling', 'on_site', 'completed', 'cancelled'
  )),

  -- Scheduling
  assigned_to UUID REFERENCES users(id),
  scheduled_date DATE,
  scheduled_time TIME,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,

  -- Status timestamps
  travel_started_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Completion
  completion_notes TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT false,

  -- Internal
  internal_notes TEXT,
  cancel_reason TEXT,

  -- Source linking (future: sales_order_id, ticket_id, contract_id)
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'sales_order', 'ticket', 'contract')),
  source_id UUID,

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (org_id, job_number)
);

CREATE INDEX idx_jobs_org ON jobs(org_id);
CREATE INDEX idx_jobs_status ON jobs(org_id, status);
CREATE INDEX idx_jobs_assigned ON jobs(assigned_to, scheduled_date);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_date ON jobs(org_id, scheduled_date);
CREATE INDEX idx_jobs_number ON jobs(org_id, job_number);

-- 3. Job notes (field engineer notes during visits)
CREATE TABLE job_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_job_notes_job ON job_notes(job_id);

-- 4. Job photos (uploaded from field)
CREATE TABLE job_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_job_photos_job ON job_photos(job_id);

-- 5. Job parts (allocated parts/products for the job)
CREATE TABLE job_parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_numbers TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_job_parts_job ON job_parts(job_id);

-- 6. Skills (for future skill-based matching)
CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX idx_skills_org ON skills(org_id);

-- 7. Engineer skills
CREATE TABLE engineer_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency TEXT DEFAULT 'competent' CHECK (proficiency IN ('learning', 'competent', 'expert')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, skill_id)
);

-- 8. Job required skills
CREATE TABLE job_required_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, skill_id)
);

-- ============================================================================
-- Views
-- ============================================================================

-- 9. Engineer utilisation view
CREATE OR REPLACE VIEW v_engineer_utilisation AS
SELECT
  j.org_id,
  j.assigned_to AS user_id,
  u.first_name,
  u.last_name,
  j.scheduled_date,
  COUNT(*) AS job_count,
  SUM(j.estimated_duration_minutes) AS total_scheduled_minutes,
  SUM(CASE WHEN j.status = 'completed' THEN j.estimated_duration_minutes ELSE 0 END) AS completed_minutes,
  SUM(CASE WHEN j.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
FROM jobs j
JOIN users u ON u.id = j.assigned_to
WHERE j.status != 'cancelled'
  AND j.assigned_to IS NOT NULL
  AND j.scheduled_date IS NOT NULL
GROUP BY j.org_id, j.assigned_to, u.first_name, u.last_name, j.scheduled_date;

-- 10. Company job history view
CREATE OR REPLACE VIEW v_company_job_history AS
SELECT
  j.id,
  j.org_id,
  j.company_id,
  j.job_number,
  j.title,
  j.status,
  j.priority,
  j.scheduled_date,
  j.completed_at,
  j.completion_notes,
  j.follow_up_required,
  jt.name AS job_type_name,
  jt.slug AS job_type_slug,
  jt.color AS job_type_color,
  jt.background AS job_type_background,
  u.first_name AS engineer_first_name,
  u.last_name AS engineer_last_name
FROM jobs j
JOIN job_types jt ON jt.id = j.job_type_id
LEFT JOIN users u ON u.id = j.assigned_to
ORDER BY j.scheduled_date DESC NULLS LAST, j.created_at DESC;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_required_skills ENABLE ROW LEVEL SECURITY;

-- job_types: admin can manage, all can read
CREATE POLICY job_types_select ON job_types FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY job_types_insert ON job_types FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY job_types_update ON job_types FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY job_types_delete ON job_types FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

-- jobs: org-scoped read for all with view permission
CREATE POLICY jobs_select ON jobs FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY jobs_insert ON jobs FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('scheduling', 'create'));

CREATE POLICY jobs_update ON jobs FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'edit'));

CREATE POLICY jobs_delete ON jobs FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'delete'));

-- job_notes: via parent job
CREATE POLICY job_notes_select ON job_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_notes_insert ON job_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_notes_update ON job_notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ) AND user_id = auth.uid());

CREATE POLICY job_notes_delete ON job_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ) AND user_id = auth.uid());

-- job_photos: via parent job
CREATE POLICY job_photos_select ON job_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_photos_insert ON job_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_photos_update ON job_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ) AND user_id = auth.uid());

CREATE POLICY job_photos_delete ON job_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ) AND user_id = auth.uid());

-- job_parts: via parent job
CREATE POLICY job_parts_select ON job_parts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_parts_insert ON job_parts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_parts_update ON job_parts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_parts_delete ON job_parts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

-- skills: org-scoped
CREATE POLICY skills_select ON skills FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY skills_insert ON skills FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY skills_update ON skills FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY skills_delete ON skills FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

-- engineer_skills: org-scoped via user
CREATE POLICY engineer_skills_select ON engineer_skills FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = user_id AND u.org_id = auth_org_id()
  ));

CREATE POLICY engineer_skills_manage ON engineer_skills FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = user_id AND u.org_id = auth_org_id()
  ) AND auth_has_permission('scheduling', 'admin'));

-- job_required_skills: via parent job
CREATE POLICY job_required_skills_select ON job_required_skills FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_required_skills_manage ON job_required_skills FOR ALL
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

-- ============================================================================
-- Storage bucket for job photos
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-photos', 'job-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY job_photos_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY job_photos_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY job_photos_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth_org_id()::text);

-- ============================================================================
-- Permissions
-- ============================================================================

INSERT INTO permissions (module, action, description) VALUES
  ('scheduling', 'view', 'View scheduled jobs and dispatch calendar'),
  ('scheduling', 'create', 'Create new jobs'),
  ('scheduling', 'edit', 'Edit and reschedule jobs'),
  ('scheduling', 'delete', 'Delete jobs'),
  ('scheduling', 'admin', 'Manage job types and scheduling config')
ON CONFLICT (module, action) DO NOTHING;

-- Admin and super_admin get all scheduling permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
  AND p.module = 'scheduling'
ON CONFLICT DO NOTHING;

-- Engineering: view, create, edit (full calendar + own jobs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
  AND p.module = 'scheduling'
  AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- Sales: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
  AND p.module = 'scheduling'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- Accounts + Purchasing: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('accounts', 'purchasing')
  AND p.module = 'scheduling'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

CREATE TRIGGER job_types_updated_at BEFORE UPDATE ON job_types
  FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

CREATE TRIGGER job_notes_updated_at BEFORE UPDATE ON job_notes
  FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();
