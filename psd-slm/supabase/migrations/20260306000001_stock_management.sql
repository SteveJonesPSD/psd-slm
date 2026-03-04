-- ============================================================================
-- STOCK MANAGEMENT & FULFILMENT MODULE
-- Tables: stock_locations, stock_levels, stock_movements, stock_allocations,
--         serial_number_registry, stock_takes, stock_take_lines,
--         delivery_notes, delivery_note_lines
-- Views:  v_stock_availability, v_so_line_fulfilment
-- Functions: adjust_stock_on_hand, adjust_stock_allocated
-- ============================================================================

-- ============================================================================
-- 1. STOCK LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id),
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    address     TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, code)
);

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_locations_select" ON stock_locations;
CREATE POLICY "stock_locations_select" ON stock_locations
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_locations_insert" ON stock_locations;
CREATE POLICY "stock_locations_insert" ON stock_locations
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_locations_update" ON stock_locations;
CREATE POLICY "stock_locations_update" ON stock_locations
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_locations_delete" ON stock_locations;
CREATE POLICY "stock_locations_delete" ON stock_locations
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_locations_org ON stock_locations(org_id);

-- ============================================================================
-- 2. STOCK LEVELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_levels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    location_id         UUID NOT NULL REFERENCES stock_locations(id),
    quantity_on_hand    INTEGER NOT NULL DEFAULT 0,
    quantity_allocated  INTEGER NOT NULL DEFAULT 0,
    reorder_point       INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, product_id, location_id),
    CHECK (quantity_on_hand >= 0),
    CHECK (quantity_allocated >= 0)
);

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_levels_select" ON stock_levels;
CREATE POLICY "stock_levels_select" ON stock_levels
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_levels_insert" ON stock_levels;
CREATE POLICY "stock_levels_insert" ON stock_levels
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_levels_update" ON stock_levels;
CREATE POLICY "stock_levels_update" ON stock_levels
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_levels_delete" ON stock_levels;
CREATE POLICY "stock_levels_delete" ON stock_levels
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_levels_org ON stock_levels(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_location ON stock_levels(location_id);

-- ============================================================================
-- 3. STOCK MOVEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    location_id     UUID NOT NULL REFERENCES stock_locations(id),
    movement_type   TEXT NOT NULL CHECK (movement_type IN (
        'goods_received', 'allocated', 'deallocated', 'picked',
        'adjustment_in', 'adjustment_out', 'stocktake_adjustment'
    )),
    quantity        INTEGER NOT NULL,
    reference_type  TEXT,
    reference_id    UUID,
    serial_numbers  JSONB DEFAULT '[]'::jsonb,
    reason          TEXT,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

-- ============================================================================
-- 4. STOCK ALLOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    location_id         UUID NOT NULL REFERENCES stock_locations(id),
    quantity_allocated  INTEGER NOT NULL CHECK (quantity_allocated > 0),
    quantity_picked     INTEGER NOT NULL DEFAULT 0 CHECK (quantity_picked >= 0),
    serial_numbers      JSONB DEFAULT '[]'::jsonb,
    status              TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN (
        'allocated', 'partially_picked', 'picked', 'cancelled'
    )),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_allocations_select" ON stock_allocations;
CREATE POLICY "stock_allocations_select" ON stock_allocations
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_allocations_insert" ON stock_allocations;
CREATE POLICY "stock_allocations_insert" ON stock_allocations
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_allocations_update" ON stock_allocations;
CREATE POLICY "stock_allocations_update" ON stock_allocations
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_allocations_delete" ON stock_allocations;
CREATE POLICY "stock_allocations_delete" ON stock_allocations
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_allocations_org ON stock_allocations(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_allocations_so_line ON stock_allocations(sales_order_line_id);
CREATE INDEX IF NOT EXISTS idx_stock_allocations_product ON stock_allocations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_allocations_status ON stock_allocations(status);

-- ============================================================================
-- 5. SERIAL NUMBER REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS serial_number_registry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    serial_number       TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN (
        'in_stock', 'allocated', 'dispatched', 'returned'
    )),
    location_id         UUID REFERENCES stock_locations(id),
    po_line_id          UUID REFERENCES purchase_order_lines(id),
    so_line_id          UUID REFERENCES sales_order_lines(id),
    delivery_note_id    UUID,
    received_at         TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, product_id, serial_number)
);

ALTER TABLE serial_number_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "serial_number_registry_select" ON serial_number_registry;
CREATE POLICY "serial_number_registry_select" ON serial_number_registry
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "serial_number_registry_insert" ON serial_number_registry;
CREATE POLICY "serial_number_registry_insert" ON serial_number_registry
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "serial_number_registry_update" ON serial_number_registry;
CREATE POLICY "serial_number_registry_update" ON serial_number_registry
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_serial_registry_org ON serial_number_registry(org_id);
CREATE INDEX IF NOT EXISTS idx_serial_registry_product ON serial_number_registry(product_id);
CREATE INDEX IF NOT EXISTS idx_serial_registry_status ON serial_number_registry(status);
CREATE INDEX IF NOT EXISTS idx_serial_registry_serial ON serial_number_registry(serial_number);
CREATE INDEX IF NOT EXISTS idx_serial_registry_so_line ON serial_number_registry(so_line_id);

-- ============================================================================
-- 6. STOCK TAKES
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_takes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    st_number       TEXT NOT NULL,
    location_id     UUID NOT NULL REFERENCES stock_locations(id),
    status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'cancelled'
    )),
    notes           TEXT,
    started_by      UUID REFERENCES users(id),
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_takes_select" ON stock_takes;
CREATE POLICY "stock_takes_select" ON stock_takes
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_takes_insert" ON stock_takes;
CREATE POLICY "stock_takes_insert" ON stock_takes
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "stock_takes_update" ON stock_takes;
CREATE POLICY "stock_takes_update" ON stock_takes
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_takes_org ON stock_takes(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_takes_location ON stock_takes(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_takes_status ON stock_takes(status);

-- ============================================================================
-- 7. STOCK TAKE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_take_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_take_id   UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    expected_qty    INTEGER NOT NULL DEFAULT 0,
    counted_qty     INTEGER,
    variance        INTEGER GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
    serials_found   JSONB DEFAULT '[]'::jsonb,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_take_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_take_lines_select" ON stock_take_lines;
CREATE POLICY "stock_take_lines_select" ON stock_take_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM stock_takes st
            WHERE st.id = stock_take_lines.stock_take_id
            AND st.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "stock_take_lines_insert" ON stock_take_lines;
CREATE POLICY "stock_take_lines_insert" ON stock_take_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM stock_takes st
            WHERE st.id = stock_take_lines.stock_take_id
            AND st.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "stock_take_lines_update" ON stock_take_lines;
CREATE POLICY "stock_take_lines_update" ON stock_take_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM stock_takes st
            WHERE st.id = stock_take_lines.stock_take_id
            AND st.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE INDEX IF NOT EXISTS idx_stock_take_lines_take ON stock_take_lines(stock_take_id);
CREATE INDEX IF NOT EXISTS idx_stock_take_lines_product ON stock_take_lines(product_id);

-- ============================================================================
-- 8. DELIVERY NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_notes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    sales_order_id          UUID NOT NULL REFERENCES sales_orders(id),
    dn_number               TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'confirmed', 'dispatched', 'delivered', 'cancelled'
    )),
    delivery_address_line1  TEXT,
    delivery_address_line2  TEXT,
    delivery_city           TEXT,
    delivery_postcode       TEXT,
    carrier                 TEXT,
    tracking_reference      TEXT,
    notes                   TEXT,
    confirmed_at            TIMESTAMPTZ,
    dispatched_at           TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_notes_select" ON delivery_notes;
CREATE POLICY "delivery_notes_select" ON delivery_notes
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "delivery_notes_insert" ON delivery_notes;
CREATE POLICY "delivery_notes_insert" ON delivery_notes
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "delivery_notes_update" ON delivery_notes;
CREATE POLICY "delivery_notes_update" ON delivery_notes
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "delivery_notes_delete" ON delivery_notes;
CREATE POLICY "delivery_notes_delete" ON delivery_notes
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_delivery_notes_org ON delivery_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_so ON delivery_notes(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);

-- ============================================================================
-- 9. DELIVERY NOTE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_note_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_note_id        UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
    sales_order_line_id     UUID REFERENCES sales_order_lines(id),
    product_id              UUID REFERENCES products(id),
    description             TEXT NOT NULL,
    quantity                INTEGER NOT NULL CHECK (quantity > 0),
    serial_numbers          JSONB DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE delivery_note_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_note_lines_select" ON delivery_note_lines;
CREATE POLICY "delivery_note_lines_select" ON delivery_note_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM delivery_notes dn
            WHERE dn.id = delivery_note_lines.delivery_note_id
            AND dn.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "delivery_note_lines_insert" ON delivery_note_lines;
CREATE POLICY "delivery_note_lines_insert" ON delivery_note_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM delivery_notes dn
            WHERE dn.id = delivery_note_lines.delivery_note_id
            AND dn.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "delivery_note_lines_update" ON delivery_note_lines;
CREATE POLICY "delivery_note_lines_update" ON delivery_note_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM delivery_notes dn
            WHERE dn.id = delivery_note_lines.delivery_note_id
            AND dn.org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE INDEX IF NOT EXISTS idx_dn_lines_dn ON delivery_note_lines(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_dn_lines_so_line ON delivery_note_lines(sales_order_line_id);

-- Add FK for serial_number_registry.delivery_note_id now that delivery_notes exists
ALTER TABLE serial_number_registry
    ADD CONSTRAINT fk_serial_delivery_note
    FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id);

-- ============================================================================
-- 10. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Upsert stock on_hand: handles INSERT on first use + increment on subsequent
CREATE OR REPLACE FUNCTION adjust_stock_on_hand(
    p_org_id      UUID,
    p_product_id  UUID,
    p_location_id UUID,
    p_delta       INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO stock_levels (org_id, product_id, location_id, quantity_on_hand)
    VALUES (p_org_id, p_product_id, p_location_id, GREATEST(p_delta, 0))
    ON CONFLICT (org_id, product_id, location_id)
    DO UPDATE SET
        quantity_on_hand = GREATEST(stock_levels.quantity_on_hand + p_delta, 0),
        updated_at = now();
END;
$$;

-- Update stock allocated qty
CREATE OR REPLACE FUNCTION adjust_stock_allocated(
    p_org_id      UUID,
    p_product_id  UUID,
    p_location_id UUID,
    p_delta       INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO stock_levels (org_id, product_id, location_id, quantity_allocated)
    VALUES (p_org_id, p_product_id, p_location_id, GREATEST(p_delta, 0))
    ON CONFLICT (org_id, product_id, location_id)
    DO UPDATE SET
        quantity_allocated = GREATEST(stock_levels.quantity_allocated + p_delta, 0),
        updated_at = now();
END;
$$;

-- ============================================================================
-- 11. VIEWS
-- ============================================================================

-- Stock availability: joins stock_levels + products + locations
CREATE OR REPLACE VIEW v_stock_availability AS
SELECT
    sl.id,
    sl.org_id,
    sl.product_id,
    sl.location_id,
    p.sku,
    p.name AS product_name,
    p.default_buy_price,
    p.is_serialised,
    p.is_stocked,
    p.category_id,
    pc.name AS category_name,
    loc.name AS location_name,
    loc.code AS location_code,
    sl.quantity_on_hand,
    sl.quantity_allocated,
    (sl.quantity_on_hand - sl.quantity_allocated) AS quantity_available,
    sl.reorder_point,
    ((sl.quantity_on_hand - sl.quantity_allocated) <= sl.reorder_point AND sl.reorder_point > 0) AS below_reorder
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN stock_locations loc ON loc.id = sl.location_id
LEFT JOIN product_categories pc ON pc.id = p.category_id;

-- SO line fulfilment status: shows coverage per line
CREATE OR REPLACE VIEW v_so_line_fulfilment AS
SELECT
    sol.id AS so_line_id,
    sol.sales_order_id,
    sol.product_id,
    sol.description,
    sol.quantity AS required_qty,
    sol.fulfilment_route,
    sol.status AS line_status,
    sol.is_service,
    -- Stock allocations
    COALESCE(alloc.total_allocated, 0) AS qty_allocated,
    COALESCE(alloc.total_picked, 0) AS qty_picked,
    -- PO coverage
    COALESCE(po_cov.qty_on_po, 0) AS qty_on_po,
    COALESCE(po_cov.qty_po_received, 0) AS qty_po_received,
    -- Derived
    sol.quantity
        - COALESCE(alloc.total_allocated, 0)
        - COALESCE(po_cov.qty_on_po, 0) AS qty_unallocated,
    CASE
        WHEN sol.is_service THEN 'ready'
        WHEN sol.status IN ('delivered', 'cancelled') THEN 'ready'
        WHEN (COALESCE(alloc.total_allocated, 0) + COALESCE(po_cov.qty_on_po, 0)) >= sol.quantity THEN
            CASE
                WHEN (COALESCE(alloc.total_picked, 0) + COALESCE(po_cov.qty_po_received, 0)) >= sol.quantity THEN 'ready'
                ELSE 'covered'
            END
        ELSE 'needs_action'
    END AS fulfilment_status
FROM sales_order_lines sol
LEFT JOIN LATERAL (
    SELECT
        SUM(sa.quantity_allocated) AS total_allocated,
        SUM(sa.quantity_picked) AS total_picked
    FROM stock_allocations sa
    WHERE sa.sales_order_line_id = sol.id
    AND sa.status != 'cancelled'
) alloc ON true
LEFT JOIN LATERAL (
    SELECT
        SUM(pol.quantity) AS qty_on_po,
        SUM(pol.quantity_received) AS qty_po_received
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.purchase_order_id
    WHERE pol.sales_order_line_id = sol.id
    AND pol.status != 'cancelled'
    AND po.status != 'cancelled'
) po_cov ON true;

-- ============================================================================
-- 12. PERMISSIONS & ROLE GRANTS
-- ============================================================================

INSERT INTO permissions (module, action, description) VALUES
    ('stock', 'view', 'View stock levels and movements'),
    ('stock', 'create', 'Create stock adjustments and takes'),
    ('stock', 'edit', 'Edit stock levels and allocations'),
    ('stock', 'delete', 'Delete stock records'),
    ('delivery_notes', 'view', 'View delivery notes'),
    ('delivery_notes', 'create', 'Create delivery notes'),
    ('delivery_notes', 'edit', 'Edit and update delivery note status'),
    ('delivery_notes', 'delete', 'Delete delivery notes')
ON CONFLICT (module, action) DO NOTHING;

-- admin + super_admin: all stock + delivery_notes permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'super_admin')
AND p.module IN ('stock', 'delivery_notes')
ON CONFLICT DO NOTHING;

-- purchasing: all stock + delivery_notes permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
AND p.module IN ('stock', 'delivery_notes')
ON CONFLICT DO NOTHING;

-- sales: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
AND p.module IN ('stock', 'delivery_notes')
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- accounts: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'accounts'
AND p.module IN ('stock', 'delivery_notes')
AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- engineering: stock view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
AND p.module = 'stock'
AND p.action = 'view'
ON CONFLICT DO NOTHING;
