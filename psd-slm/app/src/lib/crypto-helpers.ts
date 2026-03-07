/**
 * lib/crypto-helpers.ts
 * Convenience decrypt/encrypt wrappers for common entity types.
 * SERVER-SIDE ONLY — imports from lib/crypto.ts.
 */
import { encrypt, decrypt, blindIndex } from '@/lib/crypto'

// Re-export core functions for convenience
export { encrypt, decrypt, blindIndex }

// ---------------------------------------------------------------------------
// Contact helpers
// ---------------------------------------------------------------------------

export function encryptContactFields(data: {
  email?: string | null
  phone?: string | null
  mobile?: string | null
}) {
  const updates: Record<string, unknown> = {}
  if (data.email !== undefined) {
    updates.email = data.email ? encrypt(data.email) : null
    updates.email_blind = data.email ? blindIndex(data.email.toLowerCase().trim()) : null
    updates.email_domain = data.email ? data.email.split('@')[1]?.toLowerCase() ?? null : null
  }
  if (data.phone !== undefined) {
    updates.phone = data.phone ? encrypt(data.phone) : null
  }
  if (data.mobile !== undefined) {
    updates.mobile = data.mobile ? encrypt(data.mobile) : null
  }
  return updates
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptContactRow<T extends Record<string, any>>(row: T): T {
  if (!row) return row
  return {
    ...row,
    email: typeof row.email === 'string' && row.email ? decrypt(row.email) : row.email,
    phone: typeof row.phone === 'string' && row.phone ? decrypt(row.phone) : row.phone,
    mobile: typeof row.mobile === 'string' && row.mobile ? decrypt(row.mobile) : row.mobile,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptContactRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(decryptContactRow)
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

export function encryptCustomerFields(data: {
  email?: string | null
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  postcode?: string | null
}) {
  const updates: Record<string, unknown> = {}
  if (data.email !== undefined) {
    updates.email = data.email ? encrypt(data.email) : null
    updates.email_blind = data.email ? blindIndex(data.email.toLowerCase().trim()) : null
  }
  if (data.phone !== undefined) {
    updates.phone = data.phone ? encrypt(data.phone) : null
  }
  if (data.address_line1 !== undefined) {
    updates.address_line1 = data.address_line1 ? encrypt(data.address_line1) : null
  }
  if (data.address_line2 !== undefined) {
    updates.address_line2 = data.address_line2 ? encrypt(data.address_line2) : null
  }
  if (data.postcode !== undefined) {
    updates.postcode = data.postcode ? encrypt(data.postcode) : null
    updates.postcode_area = data.postcode
      ? data.postcode.trim().split(' ')[0]?.toUpperCase() ?? null
      : null
  }
  return updates
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptCustomerRow<T extends Record<string, any>>(row: T): T {
  if (!row) return row
  return {
    ...row,
    email: typeof row.email === 'string' && row.email ? decrypt(row.email) : row.email,
    phone: typeof row.phone === 'string' && row.phone ? decrypt(row.phone) : row.phone,
    address_line1: typeof row.address_line1 === 'string' && row.address_line1 ? decrypt(row.address_line1) : row.address_line1,
    address_line2: typeof row.address_line2 === 'string' && row.address_line2 ? decrypt(row.address_line2) : row.address_line2,
    postcode: typeof row.postcode === 'string' && row.postcode ? decrypt(row.postcode) : row.postcode,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptCustomerRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(decryptCustomerRow)
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

export function encryptUserEmail(email: string) {
  return {
    email: encrypt(email),
    email_blind: blindIndex(email.toLowerCase().trim()),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptUserRow<T extends Record<string, any>>(row: T): T {
  if (!row) return row
  return {
    ...row,
    email: typeof row.email === 'string' && row.email ? decrypt(row.email) : row.email,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptUserRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(decryptUserRow)
}
