'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CustomersTable } from './customers-table'
import { CustomersPageActions } from './customers-page-actions'
import type { Customer, Contact } from '@/types/database'

type CustomerWithContacts = Customer & { contacts: Pick<Contact, 'id'>[] }

interface CustomersPageClientProps {
  customers: CustomerWithContacts[]
}

export function CustomersPageClient({ customers }: CustomersPageClientProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} accounts`}
        actions={<CustomersPageActions onNewCustomer={() => setShowForm(true)} />}
      />
      <CustomersTable customers={customers} showForm={showForm} onShowFormChange={setShowForm} />
    </div>
  )
}
