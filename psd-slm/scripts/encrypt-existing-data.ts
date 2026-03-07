#!/usr/bin/env npx ts-node
/**
 * scripts/encrypt-existing-data.ts
 * One-time backfill: encrypts existing PII fields and populates blind indexes.
 *
 * Usage:
 *   DRY RUN (no changes):  npx ts-node scripts/encrypt-existing-data.ts --dry-run
 *   LIVE RUN:              npx ts-node scripts/encrypt-existing-data.ts
 *
 * Prerequisites:
 *   - FIELD_ENCRYPTION_KEY and BLIND_INDEX_PEPPER must be set in environment
 *   - Run migration 20260413000001 first (adds companion columns)
 *   - Test on a copy of data before running on production
 *
 * Safety:
 *   - Skips rows where email already looks encrypted (contains ':' — the IV separator)
 *   - Logs progress and errors per record
 *   - Does not stop on individual row errors — logs and continues
 *   - contacts.email_domain is already populated — skips that field
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env from the app directory
dotenv.config({ path: path.resolve(__dirname, '../app/.env.local') })

// Import crypto after env is loaded
import { encrypt, blindIndex } from '../app/src/lib/crypto'

const isDryRun = process.argv.includes('--dry-run')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isAlreadyEncrypted(value: string | null): boolean {
  if (!value) return false
  // Encrypted values contain exactly 2 colons (iv:tag:ciphertext)
  return (value.match(/:/g) ?? []).length === 2
}

async function encryptContacts() {
  console.log('\n── Contacts ──────────────────────────────')
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, phone, mobile')

  if (error) { console.error('Failed to fetch contacts:', error); return }

  let updated = 0, skipped = 0, errors = 0

  for (const row of data ?? []) {
    if (isAlreadyEncrypted(row.email)) { skipped++; continue }

    const updates: Record<string, unknown> = {}

    if (row.email) {
      updates.email = encrypt(row.email)
      updates.email_blind = blindIndex(row.email.toLowerCase().trim())
      // email_domain already populated — do not overwrite
    }
    if (row.phone) updates.phone = encrypt(row.phone)
    if (row.mobile) updates.mobile = encrypt(row.mobile)

    if (Object.keys(updates).length === 0) { skipped++; continue }

    if (isDryRun) {
      console.log(`[DRY RUN] Would update contact ${row.id}:`, Object.keys(updates))
      updated++
      continue
    }

    const { error: updateError } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', row.id)

    if (updateError) {
      console.error(`Error updating contact ${row.id}:`, updateError)
      errors++
    } else {
      updated++
    }
  }

  console.log(`Contacts: ${updated} updated, ${skipped} skipped, ${errors} errors`)
}

async function encryptCustomers() {
  console.log('\n── Customers ─────────────────────────────')
  const { data, error } = await supabase
    .from('customers')
    .select('id, email, phone, address_line1, address_line2, postcode')

  if (error) { console.error('Failed to fetch customers:', error); return }

  let updated = 0, skipped = 0, errors = 0

  for (const row of data ?? []) {
    if (isAlreadyEncrypted(row.email)) { skipped++; continue }

    const updates: Record<string, unknown> = {}

    if (row.email) {
      updates.email = encrypt(row.email)
      updates.email_blind = blindIndex(row.email.toLowerCase().trim())
    }
    if (row.phone) updates.phone = encrypt(row.phone)
    if (row.address_line1) updates.address_line1 = encrypt(row.address_line1)
    if (row.address_line2) updates.address_line2 = encrypt(row.address_line2)
    if (row.postcode) {
      updates.postcode = encrypt(row.postcode)
      updates.postcode_area = row.postcode.trim().split(' ')[0]?.toUpperCase() ?? null
    }

    if (Object.keys(updates).length === 0) { skipped++; continue }

    if (isDryRun) {
      console.log(`[DRY RUN] Would update customer ${row.id}:`, Object.keys(updates))
      updated++
      continue
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', row.id)

    if (updateError) {
      console.error(`Error updating customer ${row.id}:`, updateError)
      errors++
    } else {
      updated++
    }
  }

  console.log(`Customers: ${updated} updated, ${skipped} skipped, ${errors} errors`)
}

async function encryptUsers() {
  console.log('\n── Users ─────────────────────────────────')
  const { data, error } = await supabase
    .from('users')
    .select('id, email')

  if (error) { console.error('Failed to fetch users:', error); return }

  let updated = 0, skipped = 0, errors = 0

  for (const row of data ?? []) {
    if (isAlreadyEncrypted(row.email)) { skipped++; continue }

    const updates: Record<string, unknown> = {}
    if (row.email) {
      updates.email = encrypt(row.email)
      updates.email_blind = blindIndex(row.email.toLowerCase().trim())
    }

    if (Object.keys(updates).length === 0) { skipped++; continue }

    if (isDryRun) {
      console.log(`[DRY RUN] Would update user ${row.id}:`, Object.keys(updates))
      updated++
      continue
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', row.id)

    if (updateError) {
      console.error(`Error updating user ${row.id}:`, updateError)
      errors++
    } else {
      updated++
    }
  }

  console.log(`Users: ${updated} updated, ${skipped} skipped, ${errors} errors`)
}

async function main() {
  console.log(`\nEngage — PII Field Encryption Backfill`)
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE — data will be encrypted'}`)
  console.log(`Time: ${new Date().toISOString()}`)

  if (!process.env.FIELD_ENCRYPTION_KEY || !process.env.BLIND_INDEX_PEPPER) {
    console.error('ERROR: FIELD_ENCRYPTION_KEY and BLIND_INDEX_PEPPER must be set')
    process.exit(1)
  }

  await encryptContacts()
  await encryptCustomers()
  await encryptUsers()

  console.log('\n── Complete ──────────────────────────────')
  if (isDryRun) {
    console.log('Dry run complete. Review output above, then run without --dry-run to apply.')
  } else {
    console.log('Backfill complete. Verify a sample of records in the Supabase dashboard.')
    console.log('Verification query:')
    console.log("  SELECT id, email, email_blind FROM contacts LIMIT 3;")
    console.log('Encrypted email should look like: base64string:base64string:base64string')
  }
}

main().catch(console.error)
