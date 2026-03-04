-- Purchase Orders Module Extensions
-- Extends existing purchase_orders and purchase_order_lines tables

-- Add delivery destination tracking to POs
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_destination TEXT DEFAULT 'psd_office'
    CHECK (delivery_destination IN ('psd_office', 'customer_site'));

-- Add delivery address fields
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_address_line2 TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_city TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_postcode TEXT;

-- Add reference back to the creating user
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add delivery cost tracking
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) DEFAULT 0;

-- On PO lines, add status tracking per line
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'ordered', 'partial_received', 'received', 'cancelled'));

-- =============================================
-- RLS Policies for purchase_orders
-- =============================================

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe re-run)
DROP POLICY IF EXISTS "po_select_org" ON purchase_orders;
DROP POLICY IF EXISTS "po_insert_org" ON purchase_orders;
DROP POLICY IF EXISTS "po_update_org" ON purchase_orders;
DROP POLICY IF EXISTS "po_delete_org" ON purchase_orders;
DROP POLICY IF EXISTS "pol_select_org" ON purchase_order_lines;
DROP POLICY IF EXISTS "pol_insert_org" ON purchase_order_lines;
DROP POLICY IF EXISTS "pol_update_org" ON purchase_order_lines;
DROP POLICY IF EXISTS "pol_delete_org" ON purchase_order_lines;

-- Purchase orders: org-scoped access
CREATE POLICY "po_select_org" ON purchase_orders
    FOR SELECT USING (org_id = (
        SELECT org_id FROM users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "po_insert_org" ON purchase_orders
    FOR INSERT WITH CHECK (org_id = (
        SELECT org_id FROM users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "po_update_org" ON purchase_orders
    FOR UPDATE USING (org_id = (
        SELECT org_id FROM users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "po_delete_org" ON purchase_orders
    FOR DELETE USING (org_id = (
        SELECT org_id FROM users WHERE auth_id = auth.uid()
    ));

-- Purchase order lines: access via parent PO org scope
CREATE POLICY "pol_select_org" ON purchase_order_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND po.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "pol_insert_org" ON purchase_order_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND po.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "pol_update_org" ON purchase_order_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND po.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "pol_delete_org" ON purchase_order_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND po.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

-- =============================================
-- Permissions
-- =============================================

-- Add purchase_orders permissions (idempotent)
INSERT INTO permissions (module, action, description) VALUES
    ('purchase_orders', 'view', 'View purchase orders'),
    ('purchase_orders', 'create', 'Create purchase orders'),
    ('purchase_orders', 'edit', 'Edit purchase orders'),
    ('purchase_orders', 'delete', 'Delete purchase orders')
ON CONFLICT (module, action) DO NOTHING;

-- Grant permissions to roles
-- admin / super_admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'purchase_orders'
ON CONFLICT DO NOTHING;

-- purchasing: full access (primary PO users)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module = 'purchase_orders'
ON CONFLICT DO NOTHING;

-- accounts: view + edit (for receiving goods, adjusting costs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module = 'purchase_orders'
AND p.action IN ('view', 'edit')
ON CONFLICT DO NOTHING;

-- sales: view only (can see PO status for their SOs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module = 'purchase_orders'
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- engineering: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'purchase_orders'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
