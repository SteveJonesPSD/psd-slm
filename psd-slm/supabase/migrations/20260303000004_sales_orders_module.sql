-- ============================================================================
-- Sales Orders Module — Schema Extensions, RLS & Permissions
-- Migration: 20260303000004_sales_orders_module
-- ============================================================================

-- ============================================================================
-- 1. EXTEND sales_orders TABLE
-- ============================================================================
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS requested_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS requires_install BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_install_date DATE,
  ADD COLUMN IF NOT EXISTS install_notes TEXT,
  ADD COLUMN IF NOT EXISTS quote_number TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Rename company_id to customer_id if needed (schema uses companies, TS types use customer_id)
-- The original schema used company_id — keep consistent with existing convention.
-- If column is company_id, rename for consistency with TS types (customer_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE sales_orders RENAME COLUMN company_id TO customer_id;
  END IF;
END $$;

-- ============================================================================
-- 2. EXTEND sales_order_lines TABLE
-- ============================================================================

-- Drop old status CHECK and add expanded one
ALTER TABLE sales_order_lines
  DROP CONSTRAINT IF EXISTS sales_order_lines_status_check;

ALTER TABLE sales_order_lines
  ADD CONSTRAINT sales_order_lines_status_check
  CHECK (status IN ('pending', 'picked', 'ordered', 'partial_received', 'received', 'delivered', 'cancelled'));

-- Add new columns
ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS delivery_destination TEXT DEFAULT 'customer_site',
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS group_sort INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_contract BOOLEAN DEFAULT false;

-- Add CHECK for delivery_destination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'sales_order_lines' AND constraint_name = 'sales_order_lines_delivery_destination_check'
  ) THEN
    ALTER TABLE sales_order_lines
      ADD CONSTRAINT sales_order_lines_delivery_destination_check
      CHECK (delivery_destination IN ('psd_office', 'customer_site'));
  END IF;
END $$;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES — sales_orders
-- ============================================================================
CREATE POLICY sales_orders_select ON sales_orders FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY sales_orders_insert ON sales_orders FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'create'));

CREATE POLICY sales_orders_update ON sales_orders FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'edit'));

CREATE POLICY sales_orders_delete ON sales_orders FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'delete'));

-- ============================================================================
-- 5. RLS POLICIES — sales_order_lines (via parent SO)
-- ============================================================================
CREATE POLICY so_lines_select ON sales_order_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id()
  ));

CREATE POLICY so_lines_insert ON sales_order_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id()
  ) AND auth_has_permission('sales_orders', 'create'));

CREATE POLICY so_lines_update ON sales_order_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id()
  ) AND auth_has_permission('sales_orders', 'edit'));

CREATE POLICY so_lines_delete ON sales_order_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id()
  ) AND auth_has_permission('sales_orders', 'delete'));

-- ============================================================================
-- 6. PERMISSIONS
-- ============================================================================
INSERT INTO permissions (module, action, description) VALUES
  ('sales_orders', 'view', 'View sales orders'),
  ('sales_orders', 'create', 'Create sales orders'),
  ('sales_orders', 'edit', 'Edit sales orders'),
  ('sales_orders', 'delete', 'Delete sales orders')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================================
-- 7. ROLE-PERMISSION GRANTS
-- ============================================================================

-- super_admin and admin get all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
  AND p.module = 'sales_orders'
  AND p.action IN ('view', 'create', 'edit', 'delete')
ON CONFLICT DO NOTHING;

-- sales gets view/create/edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
  AND p.module = 'sales_orders'
  AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- purchasing gets view/create/edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
  AND p.module = 'sales_orders'
  AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- engineering gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
  AND p.module = 'sales_orders'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- accounts gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
  AND p.module = 'sales_orders'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;
