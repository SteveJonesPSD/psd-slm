'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export function NewQuoteButton() {
  const { hasPermission } = useAuth()

  if (!hasPermission('quotes', 'create')) return null

  return (
    <Button
      size="sm"
      variant="primary"
      onClick={() => alert('Quote Builder coming soon in Module 6.')}
    >
      + New Quote
    </Button>
  )
}
