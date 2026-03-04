'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { seedQuotes } from './actions'
import { SupplierQuoteModal } from './supplier-quote-modal'

export function QuotesPageActions() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [seeding, setSeeding] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

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
    <>
      <div className="flex items-center gap-2">
        {canCreate && (
          <Button size="sm" variant="default" onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Seeding...' : 'Seed Data'}
          </Button>
        )}
        {canCreate && (
          <Button size="sm" variant="purple" onClick={() => setShowImportModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI Quote
          </Button>
        )}
        {canCreate && (
          <Button size="sm" variant="primary" onClick={() => router.push('/quotes/new')}>
            + New Quote
          </Button>
        )}
      </div>

      {showImportModal && (
        <SupplierQuoteModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  )
}
