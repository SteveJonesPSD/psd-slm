import { getOnsiteJobs, getCustomersForSelect } from '../actions'
import { OnsiteJobsView } from './onsite-jobs-view'

export default async function OnsitePage() {
  const [jobsResult, customers] = await Promise.all([
    getOnsiteJobs(),
    getCustomersForSelect(),
  ])

  return (
    <OnsiteJobsView
      initialJobs={jobsResult.data || []}
      customers={customers}
    />
  )
}
