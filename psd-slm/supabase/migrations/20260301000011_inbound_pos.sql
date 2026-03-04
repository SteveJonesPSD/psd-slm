-- ============================================================================
-- Inbound Purchase Orders — PDF upload, AI extraction, quote matching
-- Migration: 20260301000011_inbound_pos
-- ============================================================================

-- 1. Main table: inbound purchase orders
CREATE TABLE inbound_purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),

  -- Source tracking (manual upload now, email integration later)
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'email')),
  original_filename TEXT,
  pdf_storage_path TEXT,

  -- OCR / extraction
  extraction_method TEXT CHECK (extraction_method IN ('text_layer', 'ocr_vision')),
  extraction_confidence TEXT CHECK (extraction_confidence IN ('high', 'medium', 'low', 'failed')),
  raw_extracted_text TEXT,
  extracted_data JSONB,

  -- Denormalised extracted fields (editable by reviewer)
  customer_po_number TEXT,
  customer_name TEXT,
  contact_name TEXT,
  po_date DATE,
  total_value NUMERIC(12,2),
  delivery_address TEXT,
  special_instructions TEXT,
  our_reference TEXT,

  -- Matching
  matched_company_id UUID REFERENCES customers(id),
  matched_quote_id UUID REFERENCES quotes(id),
  match_confidence TEXT CHECK (match_confidence IN ('exact', 'high', 'low', 'none')),
  match_method TEXT,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN (
    'uploading', 'extracting', 'pending_review', 'matched',
    'processing', 'completed', 'rejected', 'error'
  )),
  error_message TEXT,
  reject_reason TEXT,
  internal_notes TEXT,

  -- Audit
  uploaded_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  sales_order_id UUID REFERENCES sales_orders(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbound_pos_org ON inbound_purchase_orders(org_id);
CREATE INDEX idx_inbound_pos_status ON inbound_purchase_orders(org_id, status);
CREATE INDEX idx_inbound_pos_company ON inbound_purchase_orders(matched_company_id);
CREATE INDEX idx_inbound_pos_quote ON inbound_purchase_orders(matched_quote_id);

-- 2. Line items extracted from the PO
CREATE TABLE inbound_po_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inbound_po_id UUID NOT NULL REFERENCES inbound_purchase_orders(id) ON DELETE CASCADE,

  -- Extracted values
  line_number INTEGER,
  description TEXT,
  quantity NUMERIC(10,2),
  unit_price NUMERIC(12,2),
  line_total NUMERIC(12,2),
  product_code TEXT,

  -- Override values (set by reviewer)
  override_description TEXT,
  override_quantity NUMERIC(10,2),
  override_unit_price NUMERIC(12,2),

  -- Matching to quote line
  matched_quote_line_id UUID REFERENCES quote_lines(id),
  line_match_confidence TEXT CHECK (line_match_confidence IN ('exact', 'high', 'low', 'none')),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbound_po_lines_po ON inbound_po_lines(inbound_po_id);

-- 3. Enable RLS
ALTER TABLE inbound_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_po_lines ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for inbound_purchase_orders (org-scoped with permissions)
CREATE POLICY inbound_pos_select ON inbound_purchase_orders FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY inbound_pos_insert ON inbound_purchase_orders FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('inbound_pos', 'create'));

CREATE POLICY inbound_pos_update ON inbound_purchase_orders FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('inbound_pos', 'edit'));

CREATE POLICY inbound_pos_delete ON inbound_purchase_orders FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('inbound_pos', 'delete'));

-- 5. RLS policies for inbound_po_lines (via parent)
CREATE POLICY inbound_po_lines_select ON inbound_po_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM inbound_purchase_orders ipo
    WHERE ipo.id = inbound_po_id AND ipo.org_id = auth_org_id()
  ));

CREATE POLICY inbound_po_lines_insert ON inbound_po_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM inbound_purchase_orders ipo
    WHERE ipo.id = inbound_po_id AND ipo.org_id = auth_org_id()
  ) AND auth_has_permission('inbound_pos', 'create'));

CREATE POLICY inbound_po_lines_update ON inbound_po_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM inbound_purchase_orders ipo
    WHERE ipo.id = inbound_po_id AND ipo.org_id = auth_org_id()
  ) AND auth_has_permission('inbound_pos', 'edit'));

CREATE POLICY inbound_po_lines_delete ON inbound_po_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM inbound_purchase_orders ipo
    WHERE ipo.id = inbound_po_id AND ipo.org_id = auth_org_id()
  ) AND auth_has_permission('inbound_pos', 'delete'));

-- 6. Storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inbound-pos', 'inbound-pos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: org-scoped via path prefix (path = org_id/...)
CREATE POLICY inbound_pos_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'inbound-pos' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY inbound_pos_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inbound-pos' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY inbound_pos_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'inbound-pos' AND (storage.foldername(name))[1] = auth_org_id()::text);

-- 7. Permissions
INSERT INTO permissions (module, action, description) VALUES
  ('inbound_pos', 'view', 'View inbound purchase orders'),
  ('inbound_pos', 'create', 'Upload inbound purchase orders'),
  ('inbound_pos', 'edit', 'Edit and review inbound purchase orders'),
  ('inbound_pos', 'delete', 'Delete inbound purchase orders'),
  ('inbound_pos', 'process', 'Process inbound POs to sales orders')
ON CONFLICT (module, action) DO NOTHING;

-- 8. Role grants: admin/super_admin/sales/accounts get all
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin', 'sales', 'accounts')
  AND p.module = 'inbound_pos'
  AND p.action IN ('view', 'create', 'edit', 'delete', 'process');

-- Purchasing gets view/create/edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'purchasing'
  AND p.module = 'inbound_pos'
  AND p.action IN ('view', 'create', 'edit');

-- Engineering gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
  AND p.module = 'inbound_pos'
  AND p.action = 'view';
