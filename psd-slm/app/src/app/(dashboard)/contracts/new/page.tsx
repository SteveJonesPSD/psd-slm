import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth'
import { getContractFormData } from '../actions'
import { ContractForm } from '../contract-form'

interface PageProps {
  searchParams: Promise<{ company?: string }>
}

export default async function NewContractPage({ searchParams }: PageProps) {
  await requirePermission('contracts', 'create')
  const { company } = await searchParams
  const formData = await getContractFormData()

  return (
    <div>
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Contracts
      </Link>

      <PageHeader title="New Contract" subtitle="Create a new service contract" />

      <ContractForm
        customers={formData.customers}
        contractTypes={formData.contractTypes}
        opportunities={formData.opportunities}
        calendars={formData.calendars}
        slaPlans={formData.slaPlans}
        preselectedCustomerId={company}
      />
    </div>
  )
}
