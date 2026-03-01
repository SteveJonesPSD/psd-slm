-- ============================================================
-- 002: Authentication & RBAC Migration
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE NEW TABLES
-- ============================================================

-- Roles (org-scoped, customisable)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- machine name: super_admin, admin, sales, etc.
  display_name TEXT NOT NULL,      -- human label: Super Admin, Admin, Sales, etc.
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,  -- system roles can't be deleted
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Permissions (global, not org-scoped)
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,   -- customers, quotes, pipeline, etc.
  action TEXT NOT NULL,   -- view, create, edit_own, edit_all, delete, export
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);

-- Junction: which permissions belong to which role
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 2. SEED DEFAULT ROLES (for org 7c12d3bd-f92b-48be-aab4-32b70cba77f4)
-- ============================================================

INSERT INTO roles (org_id, name, display_name, description, is_system, sort_order)
VALUES
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'super_admin', 'Super Admin', 'Full system access, can manage all settings and users', true, 0),
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'admin', 'Admin', 'Full access to all modules, can view settings', true, 1),
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'sales', 'Sales', 'Manage customers, pipeline, quotes', true, 2),
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'accounts', 'Accounts', 'Manage invoicing, commission, view orders', true, 3),
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'purchasing', 'Purchasing', 'Manage purchase orders and suppliers', true, 4),
  ('7c12d3bd-f92b-48be-aab4-32b70cba77f4', 'engineering', 'Engineering', 'Manage products, view commercial data', true, 5)
ON CONFLICT (org_id, name) DO NOTHING;

-- ============================================================
-- 3. SEED PERMISSIONS (~50 across 13 modules)
-- ============================================================

INSERT INTO permissions (module, action, description) VALUES
  -- Customers
  ('customers', 'view', 'View customer records'),
  ('customers', 'create', 'Create new customers'),
  ('customers', 'edit_all', 'Edit any customer'),
  ('customers', 'delete', 'Delete customers'),
  -- Contacts
  ('contacts', 'view', 'View contact records'),
  ('contacts', 'create', 'Create new contacts'),
  ('contacts', 'edit_all', 'Edit any contact'),
  ('contacts', 'delete', 'Delete contacts'),
  -- Pipeline (Opportunities)
  ('pipeline', 'view', 'View opportunities'),
  ('pipeline', 'create', 'Create opportunities'),
  ('pipeline', 'edit_own', 'Edit own opportunities'),
  ('pipeline', 'edit_all', 'Edit any opportunity'),
  ('pipeline', 'delete', 'Delete opportunities'),
  -- Quotes
  ('quotes', 'view', 'View quotes'),
  ('quotes', 'create', 'Create quotes'),
  ('quotes', 'edit_own', 'Edit own quotes'),
  ('quotes', 'edit_all', 'Edit any quote'),
  ('quotes', 'delete', 'Delete quotes'),
  -- Sales Orders
  ('sales_orders', 'view', 'View sales orders'),
  ('sales_orders', 'create', 'Create sales orders'),
  ('sales_orders', 'edit_all', 'Edit any sales order'),
  ('sales_orders', 'delete', 'Delete sales orders'),
  -- Purchase Orders
  ('purchase_orders', 'view', 'View purchase orders'),
  ('purchase_orders', 'create', 'Create purchase orders'),
  ('purchase_orders', 'edit_all', 'Edit any purchase order'),
  ('purchase_orders', 'delete', 'Delete purchase orders'),
  -- Invoices
  ('invoices', 'view', 'View invoices'),
  ('invoices', 'create', 'Create invoices'),
  ('invoices', 'edit_all', 'Edit any invoice'),
  ('invoices', 'delete', 'Delete invoices'),
  -- Commission
  ('commission', 'view', 'View commission data'),
  ('commission', 'create', 'Create commission entries'),
  ('commission', 'edit_all', 'Edit commission entries'),
  ('commission', 'delete', 'Delete commission entries'),
  -- Products
  ('products', 'view', 'View products'),
  ('products', 'create', 'Create products'),
  ('products', 'edit_all', 'Edit any product'),
  ('products', 'delete', 'Delete products'),
  -- Suppliers
  ('suppliers', 'view', 'View suppliers'),
  ('suppliers', 'create', 'Create suppliers'),
  ('suppliers', 'edit_all', 'Edit any supplier'),
  ('suppliers', 'delete', 'Delete suppliers'),
  -- Team
  ('team', 'view', 'View team members'),
  ('team', 'create', 'Create team members'),
  ('team', 'edit_all', 'Edit any team member'),
  ('team', 'delete', 'Delete team members'),
  -- Settings
  ('settings', 'view', 'View settings'),
  ('settings', 'edit_all', 'Edit settings'),
  -- Reports
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- 4. ADD role_id TO USERS TABLE
-- ============================================================

-- Add role_id column (nullable initially for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- Migrate existing text roles to role_id
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE r.org_id = u.org_id
  AND u.role_id IS NULL
  AND (
    (u.role = 'admin' AND u.email = 'steve@psdgroup.co.uk' AND r.name = 'super_admin')
    OR (u.role = 'admin' AND u.email != 'steve@psdgroup.co.uk' AND r.name = 'admin')
    OR (u.role = 'sales' AND r.name = 'sales')
    OR (u.role = 'tech' AND r.name = 'engineering')
    OR (u.role = 'finance' AND r.name = 'accounts')
  );

-- Make role_id NOT NULL after migration
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

-- Drop old role column
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- ============================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER for RLS)
-- ============================================================

-- Get the org_id of the authenticated user
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM users WHERE auth_id = auth.uid()
$$;

-- Get the internal user id of the authenticated user
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;

-- Get the role name of the authenticated user
CREATE OR REPLACE FUNCTION auth_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.auth_id = auth.uid()
$$;

-- Check if the authenticated user has a specific permission
CREATE OR REPLACE FUNCTION auth_has_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.auth_id = auth.uid()
      AND p.module = p_module
      AND p.action = p_action
  )
$$;

-- ============================================================
-- 6. ENABLE RLS ON ALL ORG-SCOPED TABLES
-- ============================================================

-- Organisations
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON organisations FOR SELECT USING (id = auth_org_id());
CREATE POLICY "org_insert" ON organisations FOR INSERT WITH CHECK (false); -- orgs created by platform admin only
CREATE POLICY "org_update" ON organisations FOR UPDATE USING (id = auth_org_id() AND auth_role_name() IN ('super_admin', 'admin'));
CREATE POLICY "org_delete" ON organisations FOR DELETE USING (false);

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select" ON users FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('team', 'create'));
CREATE POLICY "users_update" ON users FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('team', 'edit_all'));
CREATE POLICY "users_delete" ON users FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('team', 'delete'));

-- Roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON roles FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "roles_insert" ON roles FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_role_name() = 'super_admin');
CREATE POLICY "roles_update" ON roles FOR UPDATE USING (org_id = auth_org_id() AND auth_role_name() = 'super_admin');
CREATE POLICY "roles_delete" ON roles FOR DELETE USING (org_id = auth_org_id() AND auth_role_name() = 'super_admin' AND is_system = false);

-- Permissions (global read-only for authenticated users)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_select" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Role Permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_perms_select" ON role_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.org_id = auth_org_id())
);
CREATE POLICY "role_perms_insert" ON role_permissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.org_id = auth_org_id())
  AND auth_role_name() = 'super_admin'
);
CREATE POLICY "role_perms_delete" ON role_permissions FOR DELETE USING (
  EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.org_id = auth_org_id())
  AND auth_role_name() = 'super_admin'
);

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON customers FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('customers', 'create'));
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('customers', 'edit_all'));
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('customers', 'delete'));

-- Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select" ON contacts FOR SELECT USING (
  EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.org_id = auth_org_id())
);
CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.org_id = auth_org_id())
  AND auth_has_permission('contacts', 'create')
);
CREATE POLICY "contacts_update" ON contacts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.org_id = auth_org_id())
  AND auth_has_permission('contacts', 'edit_all')
);
CREATE POLICY "contacts_delete" ON contacts FOR DELETE USING (
  EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.org_id = auth_org_id())
  AND auth_has_permission('contacts', 'delete')
);

-- Product Categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_cats_select" ON product_categories FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "product_cats_insert" ON product_categories FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('products', 'create'));
CREATE POLICY "product_cats_update" ON product_categories FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('products', 'edit_all'));
CREATE POLICY "product_cats_delete" ON product_categories FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('products', 'delete'));

-- Suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('suppliers', 'create'));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('suppliers', 'edit_all'));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('suppliers', 'delete'));

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select" ON products FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('products', 'create'));
CREATE POLICY "products_update" ON products FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('products', 'edit_all'));
CREATE POLICY "products_delete" ON products FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('products', 'delete'));

-- Product Suppliers
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_suppliers_select" ON product_suppliers FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = auth_org_id())
);
CREATE POLICY "product_suppliers_insert" ON product_suppliers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = auth_org_id())
  AND auth_has_permission('products', 'create')
);
CREATE POLICY "product_suppliers_update" ON product_suppliers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = auth_org_id())
  AND auth_has_permission('products', 'edit_all')
);
CREATE POLICY "product_suppliers_delete" ON product_suppliers FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.org_id = auth_org_id())
  AND auth_has_permission('products', 'delete')
);

-- Deal Registrations
ALTER TABLE deal_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_regs_select" ON deal_registrations FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "deal_regs_insert" ON deal_registrations FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('suppliers', 'create'));
CREATE POLICY "deal_regs_update" ON deal_registrations FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('suppliers', 'edit_all'));
CREATE POLICY "deal_regs_delete" ON deal_registrations FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('suppliers', 'delete'));

-- Deal Registration Lines
ALTER TABLE deal_registration_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_reg_lines_select" ON deal_registration_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id())
);
CREATE POLICY "deal_reg_lines_insert" ON deal_registration_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id())
  AND auth_has_permission('suppliers', 'create')
);
CREATE POLICY "deal_reg_lines_update" ON deal_registration_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id())
  AND auth_has_permission('suppliers', 'edit_all')
);
CREATE POLICY "deal_reg_lines_delete" ON deal_registration_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM deal_registrations dr WHERE dr.id = deal_reg_id AND dr.org_id = auth_org_id())
  AND auth_has_permission('suppliers', 'delete')
);

-- Opportunities
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opps_select" ON opportunities FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "opps_insert" ON opportunities FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('pipeline', 'create'));
CREATE POLICY "opps_update" ON opportunities FOR UPDATE USING (
  org_id = auth_org_id()
  AND (
    auth_has_permission('pipeline', 'edit_all')
    OR (auth_has_permission('pipeline', 'edit_own') AND assigned_to = auth_user_id())
  )
);
CREATE POLICY "opps_delete" ON opportunities FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('pipeline', 'delete'));

-- Quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('quotes', 'create'));
CREATE POLICY "quotes_update" ON quotes FOR UPDATE USING (
  org_id = auth_org_id()
  AND (
    auth_has_permission('quotes', 'edit_all')
    OR (auth_has_permission('quotes', 'edit_own') AND assigned_to = auth_user_id())
  )
);
CREATE POLICY "quotes_delete" ON quotes FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('quotes', 'delete'));

-- Quote Groups
ALTER TABLE quote_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_groups_select" ON quote_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
);
CREATE POLICY "quote_groups_insert" ON quote_groups FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'create')
);
CREATE POLICY "quote_groups_update" ON quote_groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND (
    auth_has_permission('quotes', 'edit_all')
    OR (auth_has_permission('quotes', 'edit_own') AND EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.assigned_to = auth_user_id()
    ))
  )
);
CREATE POLICY "quote_groups_delete" ON quote_groups FOR DELETE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'delete')
);

-- Quote Lines
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_lines_select" ON quote_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
);
CREATE POLICY "quote_lines_insert" ON quote_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'create')
);
CREATE POLICY "quote_lines_update" ON quote_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND (
    auth_has_permission('quotes', 'edit_all')
    OR (auth_has_permission('quotes', 'edit_own') AND EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.assigned_to = auth_user_id()
    ))
  )
);
CREATE POLICY "quote_lines_delete" ON quote_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'delete')
);

-- Quote Attributions
ALTER TABLE quote_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_attrs_select" ON quote_attributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
);
CREATE POLICY "quote_attrs_insert" ON quote_attributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'create')
);
CREATE POLICY "quote_attrs_update" ON quote_attributions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'edit_all')
);
CREATE POLICY "quote_attrs_delete" ON quote_attributions FOR DELETE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.org_id = auth_org_id())
  AND auth_has_permission('quotes', 'delete')
);

-- Sales Orders
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_select" ON sales_orders FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "so_insert" ON sales_orders FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'create'));
CREATE POLICY "so_update" ON sales_orders FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'edit_all'));
CREATE POLICY "so_delete" ON sales_orders FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('sales_orders', 'delete'));

-- Sales Order Lines
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_lines_select" ON sales_order_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id())
);
CREATE POLICY "so_lines_insert" ON sales_order_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id())
  AND auth_has_permission('sales_orders', 'create')
);
CREATE POLICY "so_lines_update" ON sales_order_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id())
  AND auth_has_permission('sales_orders', 'edit_all')
);
CREATE POLICY "so_lines_delete" ON sales_order_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_id AND so.org_id = auth_org_id())
  AND auth_has_permission('sales_orders', 'delete')
);

-- Purchase Orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('purchase_orders', 'create'));
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('purchase_orders', 'edit_all'));
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('purchase_orders', 'delete'));

-- Purchase Order Lines
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_lines_select" ON purchase_order_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND po.org_id = auth_org_id())
);
CREATE POLICY "po_lines_insert" ON purchase_order_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND po.org_id = auth_org_id())
  AND auth_has_permission('purchase_orders', 'create')
);
CREATE POLICY "po_lines_update" ON purchase_order_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND po.org_id = auth_org_id())
  AND auth_has_permission('purchase_orders', 'edit_all')
);
CREATE POLICY "po_lines_delete" ON purchase_order_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND po.org_id = auth_org_id())
  AND auth_has_permission('purchase_orders', 'delete')
);

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('invoices', 'create'));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('invoices', 'edit_all'));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('invoices', 'delete'));

-- Invoice Lines
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_lines_select" ON invoice_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.org_id = auth_org_id())
);
CREATE POLICY "invoice_lines_insert" ON invoice_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.org_id = auth_org_id())
  AND auth_has_permission('invoices', 'create')
);
CREATE POLICY "invoice_lines_update" ON invoice_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.org_id = auth_org_id())
  AND auth_has_permission('invoices', 'edit_all')
);
CREATE POLICY "invoice_lines_delete" ON invoice_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.org_id = auth_org_id())
  AND auth_has_permission('invoices', 'delete')
);

-- Commission Rates
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_rates_select" ON commission_rates FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "commission_rates_insert" ON commission_rates FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('commission', 'create'));
CREATE POLICY "commission_rates_update" ON commission_rates FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('commission', 'edit_all'));
CREATE POLICY "commission_rates_delete" ON commission_rates FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('commission', 'delete'));

-- Commission Entries
ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_entries_select" ON commission_entries FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "commission_entries_insert" ON commission_entries FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_has_permission('commission', 'create'));
CREATE POLICY "commission_entries_update" ON commission_entries FOR UPDATE USING (org_id = auth_org_id() AND auth_has_permission('commission', 'edit_all'));
CREATE POLICY "commission_entries_delete" ON commission_entries FOR DELETE USING (org_id = auth_org_id() AND auth_has_permission('commission', 'delete'));

-- Activity Log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (org_id = auth_org_id());

COMMIT;
