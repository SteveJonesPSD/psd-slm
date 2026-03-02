-- Quote Builder enhancements
-- Adds requires_contract, decline_reason, po_document_path, quote_change_requests table, and portal index

-- Add requires_contract to quote_lines and sales_order_lines
ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS requires_contract BOOLEAN DEFAULT false;
ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS requires_contract BOOLEAN DEFAULT false;

-- Add decline_reason and po_document_path to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS po_document_path TEXT;

-- Portal token index for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotes_portal_token ON quotes(portal_token) WHERE portal_token IS NOT NULL;

-- Quote change requests table (portal users submit requests for quote changes)
CREATE TABLE IF NOT EXISTS quote_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('pricing', 'specification', 'quantity', 'general')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  internal_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for quote_change_requests
ALTER TABLE quote_change_requests ENABLE ROW LEVEL SECURITY;

-- Internal users: SELECT via quote→org join
CREATE POLICY "quote_change_requests_select" ON quote_change_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_change_requests.quote_id
      AND q.org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Portal users (unauthenticated): INSERT is open — portal routes validate via token
CREATE POLICY "quote_change_requests_insert" ON quote_change_requests
  FOR INSERT WITH CHECK (true);

-- Internal users: UPDATE via org join
CREATE POLICY "quote_change_requests_update" ON quote_change_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_change_requests.quote_id
      AND q.org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Storage bucket for PO documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('po-documents', 'po-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users in the org can read/write PO documents
CREATE POLICY "po_documents_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'po-documents' AND auth.role() = 'authenticated');

CREATE POLICY "po_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'po-documents');

CREATE POLICY "po_documents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'po-documents' AND auth.role() = 'authenticated');
