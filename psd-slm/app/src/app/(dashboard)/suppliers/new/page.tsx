import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { SupplierForm } from '../supplier-form'

export default function NewSupplierPage() {
  return (
    <div>
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Suppliers
      </Link>

      <PageHeader title="New Supplier" />
      <SupplierForm />
    </div>
  )
}
