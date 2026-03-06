'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AiCustomerModal } from './ai-customer-modal'

interface CustomersPageActionsProps {
  onNewCustomer: () => void
}

export function CustomersPageActions({ onNewCustomer }: CustomersPageActionsProps) {
  const [showAiModal, setShowAiModal] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="purple" onClick={() => setShowAiModal(true)}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          AI Add
        </Button>
        <Button size="sm" variant="primary" onClick={onNewCustomer}>
          + New Customer
        </Button>
      </div>

      {showAiModal && (
        <AiCustomerModal
          initialMode="screenshot"
          onClose={() => setShowAiModal(false)}
        />
      )}
    </>
  )
}
