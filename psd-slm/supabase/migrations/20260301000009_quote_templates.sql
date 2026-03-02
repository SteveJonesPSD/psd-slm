-- Quote Templates: reusable quote structures with groups and lines
-- Templates store catalogue defaults; deal-reg pricing is applied at clone time

-- Templates header
CREATE TABLE quote_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_quote_type TEXT CHECK (default_quote_type IN ('business', 'education', 'charity', 'public_sector')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_templates_org ON quote_templates(org_id);
CREATE INDEX idx_quote_templates_active ON quote_templates(org_id, is_active) WHERE is_active = true;
CREATE INDEX idx_quote_templates_category ON quote_templates(org_id, category);

-- Template groups
CREATE TABLE quote_template_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_template_groups_template ON quote_template_groups(template_id);

-- Template lines
CREATE TABLE quote_template_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,
  group_id UUID REFERENCES quote_template_groups(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  supplier_id UUID REFERENCES suppliers(id),
  sort_order INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  default_buy_price NUMERIC(12,2) DEFAULT 0,
  default_sell_price NUMERIC(12,2) DEFAULT 0,
  fulfilment_route TEXT DEFAULT 'from_stock' CHECK (fulfilment_route IN ('from_stock', 'drop_ship')),
  is_optional BOOLEAN DEFAULT false,
  requires_contract BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_template_lines_template ON quote_template_lines(template_id);
CREATE INDEX idx_quote_template_lines_group ON quote_template_lines(group_id);

-- RLS policies
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_template_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_template_lines ENABLE ROW LEVEL SECURITY;

-- quote_templates: org-scoped
CREATE POLICY quote_templates_select ON quote_templates FOR SELECT USING (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY quote_templates_insert ON quote_templates FOR INSERT WITH CHECK (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY quote_templates_update ON quote_templates FOR UPDATE USING (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY quote_templates_delete ON quote_templates FOR DELETE USING (
  org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
);

-- quote_template_groups: via parent template org check
CREATE POLICY quote_template_groups_select ON quote_template_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_groups_insert ON quote_template_groups FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_groups_update ON quote_template_groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_groups_delete ON quote_template_groups FOR DELETE USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

-- quote_template_lines: via parent template org check
CREATE POLICY quote_template_lines_select ON quote_template_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_lines_insert ON quote_template_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_lines_update ON quote_template_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY quote_template_lines_delete ON quote_template_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM quote_templates qt WHERE qt.id = template_id AND qt.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()))
);

-- Permissions for templates module
INSERT INTO permissions (module, action, description) VALUES
  ('templates', 'view', 'View quote templates'),
  ('templates', 'create', 'Create quote templates'),
  ('templates', 'edit', 'Edit quote templates'),
  ('templates', 'delete', 'Delete quote templates');

-- Grant to admin, super_admin, and sales roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin', 'sales')
  AND p.module = 'templates'
  AND p.action IN ('view', 'create', 'edit', 'delete');

-- Grant view-only to other roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('accounts', 'purchasing', 'engineering')
  AND p.module = 'templates'
  AND p.action = 'view';
