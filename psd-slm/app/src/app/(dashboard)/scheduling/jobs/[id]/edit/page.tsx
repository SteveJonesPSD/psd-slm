import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJob, getCompaniesForSelect, getJobTypes, getEngineers, getLinkedSalesOrders } from '../../../actions'
import { JobForm } from '../../../job-form'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('scheduling', 'edit')
  const { id } = await params

  const [jobResult, companiesResult, typesResult, engineersResult, linkedSos] = await Promise.all([
    getJob(id),
    getCompaniesForSelect(),
    getJobTypes(),
    getEngineers(),
    getLinkedSalesOrders(id),
  ])

  if (jobResult.error || !jobResult.data) return notFound()

  const job = jobResult.data

  return (
    <div>
      <div className="mb-4">
        <Link href={`/scheduling/jobs/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Back to {job.job_number}
        </Link>
      </div>
      <PageHeader title={`Edit ${job.job_number}`} />
      <JobForm
        companies={companiesResult.data || []}
        jobTypes={(typesResult.data || []).map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          default_duration_minutes: t.default_duration_minutes,
        }))}
        engineers={(engineersResult.data || []).map(e => ({
          id: e.id,
          first_name: e.first_name,
          last_name: e.last_name,
          initials: e.initials,
          color: e.color,
        }))}
        initialData={{
          id: job.id,
          company_id: job.company_id,
          contact_id: job.contact_id,
          title: job.title,
          description: job.description,
          job_type_id: job.job_type_id,
          priority: job.priority,
          assigned_to: job.assigned_to,
          scheduled_date: job.scheduled_date,
          scheduled_time: job.scheduled_time,
          estimated_duration_minutes: job.estimated_duration_minutes,
          internal_notes: job.internal_notes,
          chargeable_type: job.chargeable_type,
          site_address_line1: job.site_address_line1,
          site_address_line2: job.site_address_line2,
          site_city: job.site_city,
          site_county: job.site_county,
          site_postcode: job.site_postcode,
        }}
        initialLinkedSos={linkedSos}
      />
    </div>
  )
}
