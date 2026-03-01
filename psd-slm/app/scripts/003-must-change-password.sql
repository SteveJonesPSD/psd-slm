-- Migration: Add must_change_password column and RPC to clear it
-- Run against Supabase SQL Editor

-- Column: defaults false so existing users are unaffected
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- RPC: lets any authenticated user clear their own flag (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET must_change_password = false WHERE auth_id = auth.uid();
END;
$$;
