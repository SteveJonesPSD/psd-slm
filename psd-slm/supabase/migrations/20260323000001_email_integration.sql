-- ============================================================================
-- EMAIL INTEGRATION
-- Mail connections (Azure AD credentials), mail channels (mailbox routing),
-- ticket emails (inbound/outbound email records), processing log (audit)
-- ============================================================================

-- 1. Mail connections store Azure AD app credentials for Graph API access.
CREATE TABLE mail_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    name            TEXT NOT NULL DEFAULT 'Microsoft 365',
    provider        TEXT NOT NULL DEFAULT 'microsoft_graph'
                    CHECK (provider IN ('microsoft_graph')),
    tenant_id       TEXT NOT NULL,
    client_id       TEXT NOT NULL,
    client_secret   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    last_token_at   TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, provider)
);

CREATE INDEX idx_mail_connections_org ON mail_connections(org_id);

ALTER TABLE mail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY mail_connections_select ON mail_connections
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_connections_insert ON mail_connections
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_connections_update ON mail_connections
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_connections_delete ON mail_connections
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));


-- 2. Mail channels map mailbox addresses to module handlers.
CREATE TABLE mail_channels (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id),
    connection_id           UUID NOT NULL REFERENCES mail_connections(id) ON DELETE CASCADE,
    mailbox_address         TEXT NOT NULL,
    handler                 TEXT NOT NULL
                            CHECK (handler IN ('helpdesk', 'purchasing', 'sales')),
    display_name            TEXT,
    is_active               BOOLEAN DEFAULT true,
    poll_interval_seconds   INTEGER DEFAULT 60,
    last_poll_at            TIMESTAMPTZ,
    last_message_at         TIMESTAMPTZ,
    sync_cursor             TEXT,
    error_count             INTEGER DEFAULT 0,
    last_error              TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, mailbox_address)
);

CREATE INDEX idx_mail_channels_org ON mail_channels(org_id);
CREATE INDEX idx_mail_channels_active ON mail_channels(org_id) WHERE is_active = true;

ALTER TABLE mail_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY mail_channels_select ON mail_channels
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_channels_insert ON mail_channels
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_channels_update ON mail_channels
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_channels_delete ON mail_channels
    FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));


-- 3. Ticket emails — inbound and outbound email records linked to tickets.
CREATE TABLE ticket_emails (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    ticket_id           UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    channel_id          UUID REFERENCES mail_channels(id),
    direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    graph_message_id    TEXT,
    internet_message_id TEXT,
    conversation_id     TEXT,
    in_reply_to         TEXT,
    from_address        TEXT NOT NULL,
    from_name           TEXT,
    to_addresses        JSONB DEFAULT '[]',
    cc_addresses        JSONB DEFAULT '[]',
    subject             TEXT,
    body_text           TEXT,
    body_html           TEXT,
    has_attachments     BOOLEAN DEFAULT false,
    attachments         JSONB DEFAULT '[]',
    sent_at             TIMESTAMPTZ,
    processed_at        TIMESTAMPTZ DEFAULT now(),
    processing_notes    TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_emails_ticket ON ticket_emails(ticket_id);
CREATE INDEX idx_ticket_emails_org ON ticket_emails(org_id);
CREATE INDEX idx_ticket_emails_message_id ON ticket_emails(internet_message_id);
CREATE INDEX idx_ticket_emails_graph_id ON ticket_emails(graph_message_id);
CREATE INDEX idx_ticket_emails_conversation ON ticket_emails(conversation_id);

ALTER TABLE ticket_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_emails_select ON ticket_emails
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY ticket_emails_insert ON ticket_emails
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY ticket_emails_update ON ticket_emails
    FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));


-- 4. Mail processing log for debugging and audit.
CREATE TABLE mail_processing_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    channel_id          UUID NOT NULL REFERENCES mail_channels(id),
    poll_started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    poll_ended_at       TIMESTAMPTZ,
    messages_found      INTEGER DEFAULT 0,
    messages_processed  INTEGER DEFAULT 0,
    messages_skipped    INTEGER DEFAULT 0,
    errors              JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mail_processing_log_channel ON mail_processing_log(channel_id, poll_started_at DESC);
CREATE INDEX idx_mail_processing_log_org ON mail_processing_log(org_id);

ALTER TABLE mail_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mail_processing_log_select ON mail_processing_log
    FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY mail_processing_log_insert ON mail_processing_log
    FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));


-- 5. Add source field to tickets for tracking email-created tickets.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'portal', 'email'));


-- 6. Permissions for email module.
INSERT INTO permissions (module, action, description) VALUES
    ('email', 'view', 'View email integration settings and logs'),
    ('email', 'edit', 'Configure email connections and channels')
ON CONFLICT (module, action) DO NOTHING;

-- admin / super_admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.module = 'email'
ON CONFLICT DO NOTHING;


-- 7. Update v_ticket_summary to include source column.
DROP VIEW IF EXISTS v_ticket_summary;
CREATE VIEW v_ticket_summary AS
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
  t.merged_into_ticket_id,
  t.tone_score,
  t.tone_trend,
  t.tone_summary,
  t.tone_updated_at,
  t.source,
  (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND NOT tm.is_internal) AS message_count,
  (SELECT COALESCE(SUM(tte.minutes), 0) FROM ticket_time_entries tte WHERE tte.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN contacts ct ON ct.id = t.contact_id
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN ticket_categories tc ON tc.id = t.category_id
LEFT JOIN brands b ON b.id = t.brand_id;


-- 8. Create email-attachments storage bucket (handled in application code).
-- Note: Supabase storage buckets are created via the dashboard or API, not SQL.
-- Bucket config: name='email-attachments', public=false, max_file_size=26214400 (25MB)
