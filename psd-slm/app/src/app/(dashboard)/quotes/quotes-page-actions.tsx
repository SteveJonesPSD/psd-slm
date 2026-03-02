'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { seedQuotes } from './actions'

export function QuotesPageActions() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [seeding, setSeeding] = useState(false)

  const canCreate = hasPermission('quotes', 'create')

  const handleSeed = async () => {
    setSeeding(true)
    const result = await seedQuotes()
    setSeeding(false)
    if ('error' in result && result.error) {
      alert(result.error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canCreate && (
        <Button size="sm" variant="default" onClick={handleSeed} disabled={seeding}>
          {seeding ? 'Seeding...' : 'Seed Data'}
        </Button>
      )}
      {canCreate && (
        <Button size="sm" variant="primary" onClick={() => router.push('/quotes/new')}>
          + New Quote
        </Button>
      )}
    </div>
  )
}
