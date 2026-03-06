'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export function SuppliersPageActions() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('suppliers', 'create')

  if (!canCreate) return null

  return (
    <Button size="sm" variant="primary" onClick={() => router.push('/suppliers/new')}>
      + New Supplier
    </Button>
  )
}
