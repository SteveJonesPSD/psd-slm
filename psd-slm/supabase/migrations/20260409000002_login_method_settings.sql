-- Seed default login method configuration into org_settings.
-- Uses category = 'login_methods', setting_key = role name, setting_value = method.
-- Valid methods: 'magic_link', 'password', 'password_mfa'

INSERT INTO org_settings (org_id, category, setting_key, setting_value)
SELECT
  o.id,
  'login_methods',
  role_config.role_name,
  to_jsonb(role_config.method)
FROM organisations o
CROSS JOIN (VALUES
  ('super_admin', 'password_mfa'),
  ('admin', 'password_mfa'),
  ('accounts', 'password_mfa'),
  ('sales', 'password'),
  ('purchasing', 'password'),
  ('engineering', 'magic_link'),
  ('field_engineer', 'magic_link')
) AS role_config(role_name, method)
ON CONFLICT (org_id, setting_key) DO NOTHING;
