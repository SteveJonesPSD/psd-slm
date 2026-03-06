'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge, JOB_STATUS_CONFIG } from '@/components/ui/badge'
import { toggleRequiresInstall, linkSoToNextJob, unlinkSoFromJob } from '../actions'
import { formatDate } from '@/lib/utils'

interface LinkedJob {
  id: string
  job_number: string
  status: string
  scheduled_date: string | null
}

interface SoInstallCardProps {
  soId: string
  soNumber: string
  customerId: string
  contactId: string | null
  requiresInstall: boolean
  requestedInstallDate: string | null
  installNotes: string | null
  deliveryAddress: {
    line1: string | null
    line2: string | null
    city: string | null
    postcode: string | null
  }
  linkedJobs: LinkedJob[]
}

export function SoInstallCard({
  soId,
  soNumber,
  customerId,
  contactId,
  requiresInstall,
  requestedInstallDate,
  installNotes,
  deliveryAddress,
  linkedJobs,
}: SoInstallCardProps) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [linkingJob, setLinkingJob] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [unlinkingJobId, setUnlinkingJobId] = useState<string | null>(null)

  const handleAddInstall = async () => {
    setToggling(true)
    const result = await toggleRequiresInstall(soId, true)
    setToggling(false)
    if (result.error) {
      alert(result.error)
    }
  }

  const handleBookJob = () => {
    const params = new URLSearchParams({
      source_type: 'sales_order',
      source_id: soId,
      source_ref: soNumber,
      customer_id: customerId,
      ...(contactId ? { contact_id: contactId } : {}),
      ...(deliveryAddress.line1 ? { addr1: deliveryAddress.line1 } : {}),
      ...(deliveryAddress.line2 ? { addr2: deliveryAddress.line2 } : {}),
      ...(deliveryAddress.city ? { city: deliveryAddress.city } : {}),
      ...(deliveryAddress.postcode ? { postcode: deliveryAddress.postcode } : {}),
      ...(installNotes ? { notes: installNotes } : {}),
    })
    router.push(`/scheduling/jobs/new?${params.toString()}`)
  }

  const handleLinkToNextJob = async () => {
    setLinkingJob(true)
    setLinkError('')
    const result = await linkSoToNextJob(soId)
    setLinkingJob(false)
    if (!result.success) {
      setLinkError(result.error || 'Failed to link to job')
    } else {
      router.refresh()
    }
  }

  const handleUnlinkJob = async (jobId: string) => {
    setUnlinkingJobId(jobId)
    await unlinkSoFromJob(soId, jobId)
    setUnlinkingJobId(null)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Installation</h3>
        {!requiresInstall && (
          <Button
            variant="default"
            size="sm"
            onClick={handleAddInstall}
            disabled={toggling}
          >
            {toggling ? 'Updating...' : 'Add Install'}
          </Button>
        )}
      </div>

      {!requiresInstall ? (
        <div className="text-sm text-slate-500">No installation required</div>
      ) : (
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Requires Install</div>
            <div className="text-slate-700">Yes</div>
          </div>

          {requestedInstallDate && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Install Date</div>
              <div className="text-slate-700">{formatDate(requestedInstallDate)}</div>
            </div>
          )}

          {installNotes && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Install Notes</div>
              <div className="text-slate-700">{installNotes}</div>
            </div>
          )}

          {/* Linked jobs */}
          <div className="pt-2 border-t border-gray-100 mt-3">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              {linkedJobs.length === 1 ? 'Job' : 'Jobs'}
            </div>
            {linkedJobs.length > 0 ? (
              <div className="space-y-2">
                {linkedJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/scheduling/jobs/${job.id}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        {job.job_number}
                      </Link>
                      {job.scheduled_date && (
                        <span className="text-xs text-slate-400 ml-2">
                          {formatDate(job.scheduled_date)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const cfg = JOB_STATUS_CONFIG[job.status]
                        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : null
                      })()}
                      <button
                        type="button"
                        onClick={() => handleUnlinkJob(job.id)}
                        disabled={unlinkingJobId === job.id}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        {unlinkingJobId === job.id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-amber-600 font-medium">No job booked</div>
            )}

            {linkedJobs.length === 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Button variant="default" size="sm" onClick={handleBookJob}>
                  Create New Job
                </Button>
                <Button variant="default" size="sm" onClick={handleLinkToNextJob} disabled={linkingJob}>
                  {linkingJob ? 'Finding...' : 'Add to Next Job'}
                </Button>
              </div>
            )}
            {linkError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-2.5 mt-2">
                <p className="text-xs text-red-700 dark:text-red-300">{linkError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
