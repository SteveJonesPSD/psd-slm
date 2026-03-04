-- ============================================================================
-- Quote Attachments — Storage Bucket, Table & RLS
-- Migration: 20260310000001_quote_attachments
-- ============================================================================

-- 1. Create private Storage bucket for quote attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-attachments',
  'quote-attachments',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create attachments metadata table
CREATE TABLE IF NOT EXISTS quote_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organisations(id),
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  file_size     integer NOT NULL,
  mime_type     text NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES users(id),
  label         text,           -- e.g. "Supplier Quote", "Survey Notes"
  source        text NOT NULL DEFAULT 'manual', -- manual | supplier_import
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote_id
  ON quote_attachments(quote_id);

-- 3. Enable RLS
ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;

-- 4. Table RLS policies

-- Anyone in the org can view attachments
CREATE POLICY "quote_attachments_select" ON quote_attachments
  FOR SELECT USING (org_id = auth_org_id());

-- Users with create or edit permissions can upload
CREATE POLICY "quote_attachments_insert" ON quote_attachments
  FOR INSERT WITH CHECK (
    org_id = auth_org_id()
    AND (
      auth_has_permission('quotes', 'create')
      OR auth_has_permission('quotes', 'edit_all')
      OR auth_has_permission('quotes', 'edit_own')
    )
  );

-- Users with edit_all or delete can remove attachments
CREATE POLICY "quote_attachments_delete" ON quote_attachments
  FOR DELETE USING (
    org_id = auth_org_id()
    AND (
      auth_has_permission('quotes', 'edit_all')
      OR auth_has_permission('quotes', 'delete')
    )
  );

-- 5. Storage RLS policies (defence-in-depth — real enforcement in server actions)

CREATE POLICY "quote_attach_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "quote_attach_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'quote-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "quote_attach_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'quote-attachments'
    AND auth.role() = 'authenticated'
  );
