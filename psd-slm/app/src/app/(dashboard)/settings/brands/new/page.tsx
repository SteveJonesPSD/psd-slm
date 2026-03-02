import { PageHeader } from '@/components/ui/page-header'
import { BrandForm } from '../brand-form'

export default function NewBrandPage() {
  return (
    <div>
      <PageHeader
        title="New Brand"
        subtitle="Create a new trading identity for your organisation"
      />
      <BrandForm />
    </div>
  )
}
