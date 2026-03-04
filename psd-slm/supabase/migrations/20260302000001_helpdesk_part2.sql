-- ============================================================================
-- HELPDESK PART 2: KB Enhancements & Portal Support
-- ============================================================================

-- KB Articles: add status, body_html, is_public, published_at
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill status from is_published
UPDATE kb_articles SET status = 'published' WHERE is_published = true AND status = 'draft';

-- KB Article Ratings: add contact_id for portal tracking
ALTER TABLE kb_article_ratings ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- KB Categories: add is_public for portal visibility
ALTER TABLE kb_categories ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- ticket_messages: add contact_id and channel for portal messages
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS channel TEXT;

-- Portal RLS policies
-- These supplement the internal RLS from the Part 1 migration.
-- Portal access is via contacts.portal_auth_id matching auth.uid()

-- Helper function to get the authenticated contact's ID
CREATE OR REPLACE FUNCTION auth_contact_id() RETURNS UUID AS $$
  SELECT id FROM contacts WHERE portal_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get the authenticated contact's company_id
CREATE OR REPLACE FUNCTION contact_company_id() RETURNS UUID AS $$
  SELECT customer_id FROM contacts WHERE portal_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if the authenticated contact is an overseer
CREATE OR REPLACE FUNCTION contact_is_overseer() RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_overseer, false) FROM contacts WHERE portal_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Portal: tickets (read)
CREATE POLICY portal_contact_tickets_select ON tickets
  FOR SELECT TO authenticated
  USING (
    -- Standard contact: own tickets
    contact_id = auth_contact_id()
    OR
    -- Overseer: all tickets for their company
    (customer_id = contact_company_id() AND contact_is_overseer())
  );

-- Portal: tickets (insert via portal)
CREATE POLICY portal_contact_tickets_insert ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Contact can create tickets for their company
    customer_id = contact_company_id()
    AND auth_contact_id() IS NOT NULL
  );

-- Portal: ticket_messages (read - no internal notes)
CREATE POLICY portal_contact_messages_select ON ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND ticket_id IN (
      SELECT id FROM tickets
      WHERE contact_id = auth_contact_id()
         OR (customer_id = contact_company_id() AND contact_is_overseer())
    )
  );

-- Portal: ticket_messages (insert - replies only)
CREATE POLICY portal_contact_messages_insert ON ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'customer'
    AND is_internal = false
    AND ticket_id IN (
      SELECT id FROM tickets
      WHERE contact_id = auth_contact_id()
         OR (customer_id = contact_company_id() AND contact_is_overseer())
    )
  );

-- Portal: ticket_attachments (read)
CREATE POLICY portal_contact_attachments_select ON ticket_attachments
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE contact_id = auth_contact_id()
         OR (customer_id = contact_company_id() AND contact_is_overseer())
    )
  );

-- Portal: ticket_attachments (insert)
CREATE POLICY portal_contact_attachments_insert ON ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE contact_id = auth_contact_id()
         OR (customer_id = contact_company_id() AND contact_is_overseer())
    )
  );

-- Portal: kb_articles (public published articles)
CREATE POLICY portal_kb_articles_select ON kb_articles
  FOR SELECT TO authenticated
  USING (
    status = 'published' AND is_public = true AND is_internal = false
  );

-- Portal: kb_article_ratings (insert)
CREATE POLICY portal_kb_ratings_insert ON kb_article_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth_contact_id() IS NOT NULL);

-- Portal: kb_article_ratings (read own)
CREATE POLICY portal_kb_ratings_select ON kb_article_ratings
  FOR SELECT TO authenticated
  USING (contact_id = auth_contact_id());
