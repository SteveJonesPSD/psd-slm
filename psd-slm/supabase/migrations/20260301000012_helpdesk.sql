-- ============================================================================
-- Helpdesk & Ticketing — Part 1: Internal toolset
-- Migration: 20260301000012_helpdesk
-- ============================================================================

-- ============================================================================
-- 1. TICKET CATEGORIES (hierarchical, 2-level)
-- ============================================================================
CREATE TABLE ticket_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  parent_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_categories_org ON ticket_categories(org_id);
CREATE INDEX idx_ticket_categories_parent ON ticket_categories(parent_id);

-- ============================================================================
-- 2. TICKET TAGS
-- ============================================================================
CREATE TABLE ticket_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_tags_org ON ticket_tags(org_id);

-- ============================================================================
-- 3. SLA PLANS
-- ============================================================================
CREATE TABLE sla_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  business_hours_start TIME DEFAULT '08:00',
  business_hours_end TIME DEFAULT '17:30',
  business_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  is_24x7 BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sla_plans_org ON sla_plans(org_id);

-- ============================================================================
-- 4. SLA PLAN TARGETS (per priority level)
-- ============================================================================
CREATE TABLE sla_plan_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sla_plan_id UUID NOT NULL REFERENCES sla_plans(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sla_plan_id, priority)
);

CREATE INDEX idx_sla_plan_targets_plan ON sla_plan_targets(sla_plan_id);

-- ============================================================================
-- 5. SUPPORT CONTRACTS
-- ============================================================================
CREATE TABLE support_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sla_plan_id UUID REFERENCES sla_plans(id),
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'helpdesk' CHECK (contract_type IN ('helpdesk', 'onsite', 'both')),
  monthly_hours NUMERIC(6,2),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  onsite_engineer TEXT,
  onsite_schedule TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_contracts_org ON support_contracts(org_id);
CREATE INDEX idx_support_contracts_customer ON support_contracts(customer_id);
CREATE INDEX idx_support_contracts_sla ON support_contracts(sla_plan_id);

-- ============================================================================
-- 6. TICKETS
-- ============================================================================
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  ticket_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  contact_id UUID REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES ticket_categories(id),
  contract_id UUID REFERENCES support_contracts(id),
  sla_plan_id UUID REFERENCES sla_plans(id),

  subject TEXT NOT NULL,
  description TEXT,
  ticket_type TEXT NOT NULL DEFAULT 'helpdesk' CHECK (ticket_type IN ('helpdesk', 'onsite_job')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'open', 'in_progress', 'waiting_on_customer',
    'escalated', 'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),

  -- SLA tracking
  sla_response_due_at TIMESTAMPTZ,
  sla_resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_response_met BOOLEAN,
  sla_resolution_met BOOLEAN,
  sla_paused_at TIMESTAMPTZ,
  sla_paused_minutes INTEGER DEFAULT 0,

  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  escalated_by UUID REFERENCES users(id),

  -- Onsite job fields
  site_location TEXT,
  room_number TEXT,
  device_details TEXT,
  scheduled_date DATE,

  -- Portal
  portal_token TEXT UNIQUE,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(org_id, ticket_number)
);

CREATE INDEX idx_tickets_org ON tickets(org_id);
CREATE INDEX idx_tickets_org_status ON tickets(org_id, status);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_tickets_contract ON tickets(contract_id);
CREATE INDEX idx_tickets_portal_token ON tickets(portal_token);
CREATE INDEX idx_tickets_priority ON tickets(org_id, priority);
CREATE INDEX idx_tickets_created ON tickets(org_id, created_at DESC);

-- ============================================================================
-- 7. TICKET MESSAGES (conversation thread)
-- ============================================================================
CREATE TABLE ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
  sender_id UUID REFERENCES users(id),
  sender_name TEXT,
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

-- ============================================================================
-- 8. TICKET ATTACHMENTS
-- ============================================================================
CREATE TABLE ticket_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_attachments_message ON ticket_attachments(message_id);

-- ============================================================================
-- 9. TICKET TAG ASSIGNMENTS (many-to-many)
-- ============================================================================
CREATE TABLE ticket_tag_assignments (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (ticket_id, tag_id)
);

-- ============================================================================
-- 10. TICKET WATCHERS
-- ============================================================================
CREATE TABLE ticket_watchers (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

-- ============================================================================
-- 11. TICKET TIME ENTRIES
-- ============================================================================
CREATE TABLE ticket_time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  minutes INTEGER NOT NULL,
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  entry_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_time_entries_ticket ON ticket_time_entries(ticket_id);
CREATE INDEX idx_ticket_time_entries_user ON ticket_time_entries(user_id);

-- ============================================================================
-- 12. SLA EVENTS (pause, resume, breach tracking)
-- ============================================================================
CREATE TABLE sla_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'started', 'paused', 'resumed', 'response_met', 'response_breached',
    'resolution_met', 'resolution_breached'
  )),
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sla_events_ticket ON sla_events(ticket_id, created_at);

-- ============================================================================
-- 13. TICKET CUSTOM FIELDS
-- ============================================================================
CREATE TABLE ticket_custom_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_custom_fields_org ON ticket_custom_fields(org_id);

-- ============================================================================
-- 14. TICKET CUSTOM FIELD VALUES
-- ============================================================================
CREATE TABLE ticket_custom_field_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES ticket_custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticket_id, field_id)
);

CREATE INDEX idx_ticket_cf_values_ticket ON ticket_custom_field_values(ticket_id);

-- ============================================================================
-- 15. CANNED RESPONSES
-- ============================================================================
CREATE TABLE canned_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  is_shared BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_canned_responses_org ON canned_responses(org_id);

-- ============================================================================
-- 16. AI SUGGESTIONS (placeholder for future)
-- ============================================================================
CREATE TABLE ai_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('reply', 'category', 'priority', 'article')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2),
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_suggestions_ticket ON ai_suggestions(ticket_id);

-- ============================================================================
-- 17. EMAIL THREADS (placeholder for email integration)
-- ============================================================================
CREATE TABLE email_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  message_id_header TEXT,
  thread_id TEXT,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  raw_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_threads_ticket ON email_threads(ticket_id);

-- ============================================================================
-- 18. KB CATEGORIES
-- ============================================================================
CREATE TABLE kb_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_categories_org ON kb_categories(org_id);

-- ============================================================================
-- 19. KB ARTICLES
-- ============================================================================
CREATE TABLE kb_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_kb_articles_org ON kb_articles(org_id);
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_slug ON kb_articles(org_id, slug);

-- ============================================================================
-- 20. KB ARTICLE RATINGS
-- ============================================================================
CREATE TABLE kb_article_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_article_ratings_article ON kb_article_ratings(article_id);

-- ============================================================================
-- 21. CONTACT TABLE AMENDMENTS
-- ============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_overseer BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_auto_created BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS portal_auth_id UUID;

-- ============================================================================
-- 22. VIEWS
-- ============================================================================

-- Ticket summary view for queue listing
CREATE OR REPLACE VIEW v_ticket_summary AS
SELECT
  t.id,
  t.org_id,
  t.ticket_number,
  t.subject,
  t.status,
  t.priority,
  t.ticket_type,
  t.created_at,
  t.updated_at,
  t.sla_response_due_at,
  t.sla_resolution_due_at,
  t.first_responded_at,
  t.resolved_at,
  t.sla_response_met,
  t.sla_resolution_met,
  t.escalation_level,
  c.id AS customer_id,
  c.name AS customer_name,
  ct.id AS contact_id,
  ct.first_name || ' ' || ct.last_name AS contact_name,
  u.id AS assigned_to_id,
  u.first_name || ' ' || u.last_name AS assigned_to_name,
  u.initials AS assigned_to_initials,
  u.color AS assigned_to_color,
  tc.name AS category_name,
  b.name AS brand_name,
  t.brand_id,
  t.category_id,
  t.contract_id,
  t.assigned_to,
  t.created_by,
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;

-- Agent workload view
CREATE OR REPLACE VIEW v_agent_workload AS
SELECT
  u.id AS user_id,
  u.first_name || ' ' || u.last_name AS user_name,
  u.initials,
  u.color,
  r.name AS role_name,
  COUNT(t.id) FILTER (WHERE t.status NOT IN ('closed', 'cancelled', 'resolved')) AS open_tickets,
  COUNT(t.id) FILTER (WHERE t.status = 'new') AS new_tickets,
  COUNT(t.id) FILTER (WHERE t.priority = 'urgent' AND t.status NOT IN ('closed', 'cancelled', 'resolved')) AS urgent_tickets,
  COALESCE(SUM(tte.minutes) FILTER (WHERE tte.entry_date = CURRENT_DATE), 0) AS time_today_minutes
FROM users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN tickets t ON t.assigned_to = u.id
LEFT JOIN ticket_time_entries tte ON tte.user_id = u.id
WHERE u.is_active = true
GROUP BY u.id, u.first_name, u.last_name, u.initials, u.color, r.name;

-- SLA compliance view
CREATE OR REPLACE VIEW v_sla_compliance AS
SELECT
  t.org_id,
  DATE_TRUNC('month', t.created_at) AS period,
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE t.sla_response_met = true) AS response_met,
  COUNT(*) FILTER (WHERE t.sla_response_met = false) AS response_breached,
  COUNT(*) FILTER (WHERE t.sla_resolution_met = true) AS resolution_met,
  COUNT(*) FILTER (WHERE t.sla_resolution_met = false) AS resolution_breached,
  ROUND(
    COUNT(*) FILTER (WHERE t.sla_response_met = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE t.sla_response_met IS NOT NULL), 0) * 100, 1
  ) AS response_pct,
  ROUND(
    COUNT(*) FILTER (WHERE t.sla_resolution_met = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE t.sla_resolution_met IS NOT NULL), 0) * 100, 1
  ) AS resolution_pct
FROM tickets t
WHERE t.sla_plan_id IS NOT NULL
GROUP BY t.org_id, DATE_TRUNC('month', t.created_at);

-- ============================================================================
-- 23. STORAGE BUCKET for ticket attachments
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ticket-attachments', 'ticket-attachments', false, 20971520, ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip'
])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY ticket_attachments_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY ticket_attachments_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth_org_id()::text);

CREATE POLICY ticket_attachments_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth_org_id()::text);

-- ============================================================================
-- 24. ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_plan_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 25. RLS POLICIES — org-scoped tables
-- ============================================================================

-- ticket_categories
CREATE POLICY ticket_categories_select ON ticket_categories FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY ticket_categories_insert ON ticket_categories FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_categories_update ON ticket_categories FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_categories_delete ON ticket_categories FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- ticket_tags
CREATE POLICY ticket_tags_select ON ticket_tags FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY ticket_tags_insert ON ticket_tags FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_tags_update ON ticket_tags FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_tags_delete ON ticket_tags FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- sla_plans
CREATE POLICY sla_plans_select ON sla_plans FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY sla_plans_insert ON sla_plans FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY sla_plans_update ON sla_plans FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY sla_plans_delete ON sla_plans FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- sla_plan_targets (via parent sla_plans)
CREATE POLICY sla_plan_targets_select ON sla_plan_targets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sla_plans sp WHERE sp.id = sla_plan_id AND sp.org_id = auth_org_id()
  ));
CREATE POLICY sla_plan_targets_insert ON sla_plan_targets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sla_plans sp WHERE sp.id = sla_plan_id AND sp.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY sla_plan_targets_update ON sla_plan_targets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM sla_plans sp WHERE sp.id = sla_plan_id AND sp.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY sla_plan_targets_delete ON sla_plan_targets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM sla_plans sp WHERE sp.id = sla_plan_id AND sp.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'admin'));

-- support_contracts
CREATE POLICY support_contracts_select ON support_contracts FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY support_contracts_insert ON support_contracts FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY support_contracts_update ON support_contracts FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY support_contracts_delete ON support_contracts FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- tickets
CREATE POLICY tickets_select ON tickets FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY tickets_insert ON tickets FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'create'));
CREATE POLICY tickets_update ON tickets FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY tickets_delete ON tickets FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'delete'));

-- ticket_messages (via parent ticket)
CREATE POLICY ticket_messages_select ON ticket_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_messages_insert ON ticket_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'create'));
CREATE POLICY ticket_messages_update ON ticket_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY ticket_messages_delete ON ticket_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'delete'));

-- ticket_attachments (via parent ticket)
CREATE POLICY ticket_attachments_select ON ticket_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_attachments_insert ON ticket_attachments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'create'));
CREATE POLICY ticket_attachments_delete ON ticket_attachments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'delete'));

-- ticket_tag_assignments (via parent ticket)
CREATE POLICY ticket_tag_assignments_select ON ticket_tag_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_tag_assignments_insert ON ticket_tag_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY ticket_tag_assignments_delete ON ticket_tag_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));

-- ticket_watchers (via parent ticket)
CREATE POLICY ticket_watchers_select ON ticket_watchers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_watchers_insert ON ticket_watchers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_watchers_delete ON ticket_watchers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

-- ticket_time_entries (via parent ticket)
CREATE POLICY ticket_time_entries_select ON ticket_time_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_time_entries_insert ON ticket_time_entries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY ticket_time_entries_update ON ticket_time_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY ticket_time_entries_delete ON ticket_time_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'delete'));

-- sla_events (via parent ticket)
CREATE POLICY sla_events_select ON sla_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY sla_events_insert ON sla_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

-- ticket_custom_fields
CREATE POLICY ticket_custom_fields_select ON ticket_custom_fields FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY ticket_custom_fields_insert ON ticket_custom_fields FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_custom_fields_update ON ticket_custom_fields FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY ticket_custom_fields_delete ON ticket_custom_fields FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- ticket_custom_field_values (via parent ticket)
CREATE POLICY ticket_cf_values_select ON ticket_custom_field_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ticket_cf_values_insert ON ticket_custom_field_values FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));
CREATE POLICY ticket_cf_values_update ON ticket_custom_field_values FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ) AND auth_has_permission('helpdesk', 'edit'));

-- canned_responses
CREATE POLICY canned_responses_select ON canned_responses FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY canned_responses_insert ON canned_responses FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY canned_responses_update ON canned_responses FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY canned_responses_delete ON canned_responses FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- ai_suggestions (via parent ticket)
CREATE POLICY ai_suggestions_select ON ai_suggestions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ai_suggestions_insert ON ai_suggestions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY ai_suggestions_update ON ai_suggestions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

-- email_threads (via parent ticket)
CREATE POLICY email_threads_select ON email_threads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));
CREATE POLICY email_threads_insert ON email_threads FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.org_id = auth_org_id()
  ));

-- kb_categories
CREATE POLICY kb_categories_select ON kb_categories FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY kb_categories_insert ON kb_categories FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY kb_categories_update ON kb_categories FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY kb_categories_delete ON kb_categories FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- kb_articles
CREATE POLICY kb_articles_select ON kb_articles FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY kb_articles_insert ON kb_articles FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY kb_articles_update ON kb_articles FOR UPDATE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));
CREATE POLICY kb_articles_delete ON kb_articles FOR DELETE
  USING (org_id = auth_org_id() AND auth_has_permission('helpdesk', 'admin'));

-- kb_article_ratings (open for all authenticated users in org)
CREATE POLICY kb_article_ratings_select ON kb_article_ratings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM kb_articles a WHERE a.id = article_id AND a.org_id = auth_org_id()
  ));
CREATE POLICY kb_article_ratings_insert ON kb_article_ratings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM kb_articles a WHERE a.id = article_id AND a.org_id = auth_org_id()
  ));

-- ============================================================================
-- 26. PERMISSIONS
-- ============================================================================
INSERT INTO permissions (module, action, description) VALUES
  ('helpdesk', 'view', 'View helpdesk tickets'),
  ('helpdesk', 'create', 'Create helpdesk tickets'),
  ('helpdesk', 'edit', 'Edit helpdesk tickets'),
  ('helpdesk', 'delete', 'Delete helpdesk tickets'),
  ('helpdesk', 'admin', 'Manage helpdesk configuration (categories, SLAs, contracts)')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================================
-- 27. ROLE-PERMISSION GRANTS
-- ============================================================================

-- super_admin and admin get all helpdesk permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
  AND p.module = 'helpdesk'
  AND p.action IN ('view', 'create', 'edit', 'delete', 'admin')
ON CONFLICT DO NOTHING;

-- engineering gets view/create/edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'engineering'
  AND p.module = 'helpdesk'
  AND p.action IN ('view', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- sales gets view/create
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales'
  AND p.module = 'helpdesk'
  AND p.action IN ('view', 'create')
ON CONFLICT DO NOTHING;

-- accounts and purchasing get view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('accounts', 'purchasing')
  AND p.module = 'helpdesk'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;
