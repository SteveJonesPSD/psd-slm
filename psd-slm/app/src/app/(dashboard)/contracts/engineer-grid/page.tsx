import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <Link href="/contracts">
            <Button size="sm">← Contracts</Button>
          </Link>
        }
      />

      <EngineerGrid engineers={engineers} />
    </div>
  )
}
