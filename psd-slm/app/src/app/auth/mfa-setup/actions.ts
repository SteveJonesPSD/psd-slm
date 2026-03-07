'use server'

import { enrollMfaFactor, verifyMfaEnrolment } from '@/lib/auth'

export async function startMfaEnrolment(): Promise<{
  factorId?: string
  qrCode?: string
  secret?: string
  error?: string
}> {
  try {
    const result = await enrollMfaFactor()
    return result
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function confirmMfaEnrolment(factorId: string, code: string): Promise<{
  error?: string
}> {
  try {
    await verifyMfaEnrolment(factorId, code)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
