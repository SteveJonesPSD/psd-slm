-- Add 'lost' to the quotes status check constraint
-- 'lost' is used when a salesperson marks a sent quote as lost (distinct from
-- 'declined' which is set when the customer declines via the portal).

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'review', 'sent', 'accepted', 'declined', 'expired', 'superseded', 'revised', 'lost'));
