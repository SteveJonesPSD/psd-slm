-- ============================================================================
-- Deal Registration Attachments — Storage Bucket, Table & RLS
-- Migration: 20260301000003_deal_registration_attachments
-- ============================================================================

-- 1. Create private Storage bucket for deal registration attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-reg-attachments',
  'deal-reg-attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'message/rfc822',
    'application/vnd.ms-outlook',
    'application/octet-stream',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create attachments metadata table
CREATE TABLE IF NOT EXISTS deal_registration_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_reg_id   uuid NOT NULL REFERENCES deal_registrations(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organisations(id),
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  file_size     integer NOT NULL,
  content_type  text NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_reg_attachments_deal_reg_id
  ON deal_registration_attachments(deal_reg_id);

-- 3. Enable RLS
ALTER TABLE deal_registration_attachments ENABLE ROW LEVEL SECURITY;

-- 4. Table RLS policies

-- Anyone in the org can view attachments (purchasing team needs this)
CREATE POLICY "deal_reg_attachments_select" ON deal_registration_attachments
  FOR SELECT USING (org_id = auth_org_id());

-- Users with create or edit permissions can upload
CREATE POLICY "deal_reg_attachments_insert" ON deal_registration_attachments
  FOR INSERT WITH CHECK (
    org_id = auth_org_id()
    AND (
      auth_has_permission('deal_registrations', 'create')
      OR auth_has_permission('deal_registrations', 'edit_all')
      OR auth_has_permission('deal_registrations', 'edit_own')
    )
  );

-- Users with edit_all or delete can remove attachments
CREATE POLICY "deal_reg_attachments_delete" ON deal_registration_attachments
  FOR DELETE USING (
    org_id = auth_org_id()
    AND (
      auth_has_permission('deal_registrations', 'edit_all')
      OR auth_has_permission('deal_registrations', 'delete')
    )
  );

-- 5. Storage RLS policies (defence-in-depth — real enforcement in server actions)

CREATE POLICY "deal_reg_attach_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'deal-reg-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "deal_reg_attach_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'deal-reg-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "deal_reg_attach_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'deal-reg-attachments'
    AND auth.role() = 'authenticated'
  );
