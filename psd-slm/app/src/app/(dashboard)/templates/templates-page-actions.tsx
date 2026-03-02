'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export function TemplatesPageActions() {
  const router = useRouter()
  const { hasPermission } = useAuth()

  const canCreate = hasPermission('templates', 'create')

  return (
    <div className="flex items-center gap-2">
      {canCreate && (
        <Button size="sm" variant="primary" onClick={() => router.push('/templates/new')}>
          + New Template
        </Button>
      )}
    </div>
  )
}
