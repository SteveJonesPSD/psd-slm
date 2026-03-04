import { requirePermission } from '@/lib/auth'
import { getJob } from '../../actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { JobDetail } from './job-detail'
import { MobileJobDetail } from './mobile-job-detail'
import { MobileDetector } from '@/components/ui/mobile-detector'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('scheduling', 'view')
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  const canEdit = user.permissions.includes('scheduling.edit')

  const desktop = (
    <div>
      <div className="mb-4">
        <Link href="/scheduling" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Scheduling
        </Link>
      </div>
      <JobDetail job={result.data} canEdit={canEdit} />
    </div>
  )

  const mobile = <MobileJobDetail job={result.data} />

  return <MobileDetector desktop={desktop} mobile={mobile} />
}
