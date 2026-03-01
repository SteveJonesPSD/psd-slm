import { createClient } from '@supabase/supabase-js'
// Run with: npx tsx --env-file .env.local scripts/seed-role-permissions.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ORG_ID = '7c12d3bd-f92b-48be-aab4-32b70cba77f4'

// Permission matrix: role → module → actions
// 'ALL' expands to all actions for that module
const ROLE_MATRIX: Record<string, Record<string, string[]>> = {
  super_admin: {
    customers: ['ALL'],
    contacts: ['ALL'],
    pipeline: ['ALL'],
    quotes: ['ALL'],
    sales_orders: ['ALL'],
    purchase_orders: ['ALL'],
    invoices: ['ALL'],
    commission: ['ALL'],
    products: ['ALL'],
    suppliers: ['ALL'],
    deal_registrations: ['ALL'],
    team: ['ALL'],
    settings: ['ALL'],
    reports: ['ALL'],
  },
  admin: {
    customers: ['ALL'],
    contacts: ['ALL'],
    pipeline: ['ALL'],
    quotes: ['ALL'],
    sales_orders: ['ALL'],
    purchase_orders: ['ALL'],
    invoices: ['ALL'],
    commission: ['ALL'],
    products: ['ALL'],
    suppliers: ['ALL'],
    deal_registrations: ['ALL'],
    team: ['ALL'],
    settings: ['view'],
    reports: ['ALL'],
  },
  sales: {
    customers: ['ALL'],
    contacts: ['ALL'],
    pipeline: ['view', 'create', 'edit_own'],
    quotes: ['view', 'create', 'edit_own'],
    sales_orders: ['view'],
    purchase_orders: ['view'],
    invoices: ['view'],
    commission: ['view'],
    products: ['view'],
    suppliers: ['view'],
    deal_registrations: ['view', 'create', 'edit_own'],
    team: ['view'],
    reports: ['view'],
  },
  accounts: {
    customers: ['view'],
    contacts: ['view'],
    pipeline: ['view'],
    quotes: ['view'],
    sales_orders: ['view', 'create', 'edit_all'],
    purchase_orders: ['view'],
    invoices: ['ALL'],
    commission: ['ALL'],
    products: ['view'],
    suppliers: ['view'],
    deal_registrations: ['view'],
    team: ['view'],
    reports: ['view', 'export'],
  },
  purchasing: {
    customers: ['view'],
    contacts: ['view'],
    pipeline: ['view'],
    quotes: ['view'],
    sales_orders: ['view'],
    purchase_orders: ['ALL'],
    invoices: ['view'],
    products: ['view'],
    suppliers: ['ALL'],
    deal_registrations: ['view'],
    team: ['view'],
    reports: ['view'],
  },
  engineering: {
    customers: ['view'],
    contacts: ['view'],
    pipeline: ['view'],
    quotes: ['view'],
    sales_orders: ['view'],
    purchase_orders: ['view'],
    invoices: ['view'],
    products: ['ALL'],
    suppliers: ['view'],
    deal_registrations: ['view'],
    team: ['view'],
    reports: ['view'],
  },
}

async function seed() {
  console.log('Seeding role permissions...\n')

  // Fetch all roles for our org
  const { data: roles, error: rolesErr } = await supabase
    .from('roles')
    .select('id, name')
    .eq('org_id', ORG_ID)
  if (rolesErr) { console.error('Error fetching roles:', rolesErr); return }

  // Fetch all permissions
  const { data: permissions, error: permsErr } = await supabase
    .from('permissions')
    .select('id, module, action')
  if (permsErr) { console.error('Error fetching permissions:', permsErr); return }

  // Index permissions by module+action
  const permLookup = new Map<string, string>()
  for (const p of permissions!) {
    permLookup.set(`${p.module}.${p.action}`, p.id)
  }

  // Index permissions by module (for ALL expansion)
  const moduleActions = new Map<string, string[]>()
  for (const p of permissions!) {
    const existing = moduleActions.get(p.module) || []
    existing.push(p.action)
    moduleActions.set(p.module, existing)
  }

  let totalInserted = 0

  for (const role of roles!) {
    const matrix = ROLE_MATRIX[role.name]
    if (!matrix) {
      console.log(`  Skipping role "${role.name}" — not in matrix`)
      continue
    }

    const inserts: { role_id: string; permission_id: string }[] = []

    for (const [module, actions] of Object.entries(matrix)) {
      const expandedActions = actions.includes('ALL')
        ? (moduleActions.get(module) || [])
        : actions

      for (const action of expandedActions) {
        const permId = permLookup.get(`${module}.${action}`)
        if (permId) {
          inserts.push({ role_id: role.id, permission_id: permId })
        } else {
          console.warn(`  Warning: permission ${module}.${action} not found`)
        }
      }
    }

    // Clear existing role permissions first (idempotent)
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', role.id)

    if (inserts.length > 0) {
      const { error } = await supabase
        .from('role_permissions')
        .insert(inserts)
      if (error) {
        console.error(`  Error seeding ${role.name}:`, error)
      } else {
        console.log(`  ✓ ${role.name}: ${inserts.length} permissions`)
        totalInserted += inserts.length
      }
    }
  }

  console.log(`\nDone! ${totalInserted} role-permission assignments created.`)
}

seed().catch(console.error)
