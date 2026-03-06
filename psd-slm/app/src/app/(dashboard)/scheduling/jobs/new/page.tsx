import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getCompaniesForSelect, getJobTypes, getEngineers, getWorkingDays } from '../../actions'
import { JobForm } from '../../job-form'

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function NewJobPage({ searchParams }: PageProps) {
  await requirePermission('scheduling', 'create')

  const params = await searchParams

  const [companiesResult, typesResult, engineersResult, workingDays] = await Promise.all([
    getCompaniesForSelect(),
    getJobTypes(),
    getEngineers(),
    getWorkingDays(),
  ])

  // Source linking from URL params (e.g. from SO install column)
  const sourceType = params.source_type as 'sales_order' | 'ticket' | 'contract' | undefined
  const sourceId = params.source_id
  const sourceRef = params.source_ref

  // Pre-fill data from URL params
  const prefill = (params.customer_id || params.addr1) ? {
    company_id: params.customer_id,
    contact_id: params.contact_id,
    site_address_line1: params.addr1,
    site_address_line2: params.addr2,
    site_city: params.city,
    site_postcode: params.postcode,
    internal_notes: params.notes,
  } : undefined

  return (
    <div>
      <PageHeader title="New Job" subtitle={sourceRef ? `for ${sourceRef}` : undefined} />
      <JobForm
        companies={companiesResult.data || []}
        workingDays={workingDays}
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
        sourceType={sourceType}
        sourceId={sourceId}
        sourceRef={sourceRef}
        prefill={prefill}
      />
    </div>
  )
}
