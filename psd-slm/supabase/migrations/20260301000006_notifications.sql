-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Acknowledgement fields on quotes
ALTER TABLE quotes ADD COLUMN acknowledged_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN acknowledged_by UUID REFERENCES users(id);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  AND user_id = auth.uid()
);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);

CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
  org_id = (SELECT org_id FROM users WHERE id = auth.uid())
);
