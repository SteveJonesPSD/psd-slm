-- Xero Integration: add push tracking fields to invoices
-- Existing xero_invoice_id, xero_status, xero_last_synced already present from 20260308000001_invoicing_module.sql
-- This migration adds the additional push tracking columns

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS xero_pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xero_error TEXT,
  ADD COLUMN IF NOT EXISTS xero_push_attempts INTEGER DEFAULT 0;

-- Update xero_status constraint to include 'pending' state
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_xero_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_xero_status_check
  CHECK (xero_status IS NULL OR xero_status IN ('pending', 'synced', 'failed'));

-- Index for efficient "find unsynced sent invoices" queries
CREATE INDEX IF NOT EXISTS idx_invoices_xero_status ON invoices(org_id, xero_status, status);
