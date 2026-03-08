import { requirePermission } from '@/lib/auth'
import { getJob } from '../../actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { JobDetail } from './job-detail'
import { MobileJobDetail } from './mobile-job-detail'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { getOnsiteJobCountForCustomer, getOnsiteJobItems } from '../../../helpdesk/onsite-jobs/actions'
import type { OnsiteJobItem } from '@/lib/onsite-jobs/types'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('scheduling', 'view')
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  const canEdit = user.permissions.includes('scheduling.edit')

  const customerId = (result.data as Record<string, unknown>).customer_id as string

  // Fetch OJI data for the customer
  let ojiCount = 0
  let onsiteJobItems: OnsiteJobItem[] = []
  try {
    if (customerId) {
      const ojiResult = await getOnsiteJobItems({ customerId })
      onsiteJobItems = ojiResult.data || []
      ojiCount = onsiteJobItems.filter(i => !['complete', 'cancelled'].includes(i.status)).length
    }
  } catch {
    // OJI module may not be deployed
  }

  const desktop = (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/scheduling" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Scheduling
        </Link>
        {ojiCount > 0 && customerId && (
          <Link
            href={`/helpdesk/onsite-jobs/customer/${customerId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 no-underline hover:shadow-sm transition-shadow"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {ojiCount} Onsite Job{ojiCount !== 1 ? 's' : ''} Awaiting
          </Link>
        )}
      </div>
      <JobDetail job={result.data} canEdit={canEdit} />
    </div>
  )

  const mobile = <MobileJobDetail job={result.data} onsiteJobItems={onsiteJobItems} />

  return <MobileDetector desktop={desktop} mobile={mobile} />
}
