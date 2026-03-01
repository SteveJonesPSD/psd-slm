import { createClient } from '@supabase/supabase-js'
// Run with: npx tsx --env-file .env.local scripts/create-auth-accounts.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEMP_PASSWORD = 'PsdGroup2026!'

const TEAM_MEMBERS = [
  { email: 'steve@psdgroup.co.uk', first_name: 'Steve', last_name: 'Dixon' },
  { email: 'mark@psdgroup.co.uk', first_name: 'Mark', last_name: 'Reynolds' },
  { email: 'rachel@psdgroup.co.uk', first_name: 'Rachel', last_name: 'Booth' },
  { email: 'jake@psdgroup.co.uk', first_name: 'Jake', last_name: 'Parry' },
  { email: 'lisa@psdgroup.co.uk', first_name: 'Lisa', last_name: 'Greenwood' },
  { email: 'dan@psdgroup.co.uk', first_name: 'Dan', last_name: 'Whittle' },
  { email: 'sam@psdgroup.co.uk', first_name: 'Sam', last_name: 'Hartley' },
]

async function createAuthAccounts() {
  console.log('Creating Supabase Auth accounts for team members...\n')

  for (const member of TEAM_MEMBERS) {
    // Check if user already has auth_id set
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('email', member.email)
      .single()

    if (existingUser?.auth_id) {
      console.log(`  ⏭ ${member.email} — already has auth account`)
      continue
    }

    // Create Supabase Auth account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: member.email,
      password: TEMP_PASSWORD,
      email_confirm: true, // Skip email verification
      user_metadata: {
        first_name: member.first_name,
        last_name: member.last_name,
      },
    })

    if (authError) {
      console.error(`  ✗ ${member.email} — ${authError.message}`)
      continue
    }

    // Link auth_id on users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ auth_id: authData.user.id })
      .eq('email', member.email)

    if (updateError) {
      console.error(`  ✗ ${member.email} — linked auth but failed to update users table: ${updateError.message}`)
    } else {
      console.log(`  ✓ ${member.email} — auth account created (ID: ${authData.user.id})`)
    }
  }

  console.log(`\nDone! Temporary password for all accounts: ${TEMP_PASSWORD}`)
  console.log('Users should change their password on first login.')
}

createAuthAccounts().catch(console.error)
