-- Add CC and BCC address columns to quote_email_sends
ALTER TABLE quote_email_sends
  ADD COLUMN cc_addresses TEXT[] DEFAULT '{}',
  ADD COLUMN bcc_addresses TEXT[] DEFAULT '{}';
