import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { getFieldEngineers } from '../actions'
import { EngineerGrid } from './engineer-grid'

export default async function EngineerGridPage() {
  const engineers = await getFieldEngineers()

  return (
    <div>
      <PageHeader
        title="Engineer Week Grid"
        subtitle="4-week cycle visit patterns"
        actions={
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 transition-colors"
          >
            &larr; Contracts
          </Link>
        }
      />

      <EngineerGrid engineers={engineers} />
    </div>
  )
}
