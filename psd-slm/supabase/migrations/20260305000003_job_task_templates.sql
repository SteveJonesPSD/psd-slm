-- Job Task Templates, Template Items, and Job Tasks
-- Adds structured checklists to job types for field engineer sign-off

-- 1. Task templates (named checklists)
CREATE TABLE IF NOT EXISTS job_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Template items (tasks within a template)
-- response_type: 'yes_no' (default checkbox), 'text' (free-form), 'date' (date picker)
CREATE TABLE IF NOT EXISTS job_task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES job_task_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  response_type TEXT NOT NULL DEFAULT 'yes_no',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Job tasks (materialised instances on a job)
-- response_type copied from template item; response_value stores the engineer's answer
CREATE TABLE IF NOT EXISTS job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES job_task_template_items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  response_type TEXT NOT NULL DEFAULT 'yes_no',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  response_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Link job types to task templates
ALTER TABLE job_types ADD COLUMN IF NOT EXISTS task_template_id UUID REFERENCES job_task_templates(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_task_templates_org ON job_task_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_job_task_template_items_template ON job_task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_job ON job_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_template_item ON job_tasks(template_item_id);

-- RLS
ALTER TABLE job_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_task_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- job_task_templates policies (uses auth_org_id() and auth_has_permission())
-- ============================================================================

CREATE POLICY job_task_templates_select ON job_task_templates FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY job_task_templates_insert ON job_task_templates FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY job_task_templates_update ON job_task_templates FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

CREATE POLICY job_task_templates_delete ON job_task_templates FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('scheduling', 'admin'));

-- ============================================================================
-- job_task_template_items policies (via parent template org check)
-- ============================================================================

CREATE POLICY job_task_template_items_select ON job_task_template_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM job_task_templates t
    WHERE t.id = template_id AND t.org_id = auth_org_id()
  ));

CREATE POLICY job_task_template_items_insert ON job_task_template_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_task_templates t
      WHERE t.id = template_id AND t.org_id = auth_org_id()
    )
    AND auth_has_permission('scheduling', 'admin')
  );

CREATE POLICY job_task_template_items_update ON job_task_template_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_task_templates t
      WHERE t.id = template_id AND t.org_id = auth_org_id()
    )
    AND auth_has_permission('scheduling', 'admin')
  );

CREATE POLICY job_task_template_items_delete ON job_task_template_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM job_task_templates t
      WHERE t.id = template_id AND t.org_id = auth_org_id()
    )
    AND auth_has_permission('scheduling', 'admin')
  );

-- ============================================================================
-- job_tasks policies (via parent job org check)
-- ============================================================================

CREATE POLICY job_tasks_select ON job_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_tasks_insert ON job_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_tasks_update ON job_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
  ));

CREATE POLICY job_tasks_delete ON job_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = job_id AND j.org_id = auth_org_id()
    )
    AND auth_has_permission('scheduling', 'admin')
  );
