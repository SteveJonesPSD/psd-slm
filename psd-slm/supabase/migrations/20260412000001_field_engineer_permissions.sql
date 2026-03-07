-- Remove contracts.view and products.view from field_engineer role.
-- Field engineers should only see scheduling (their own jobs), helpdesk, and customers.

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = 'field_engineer')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE (module = 'contracts' AND action = 'view')
       OR (module = 'products' AND action = 'view')
  );
