import { PageHeader } from '@/components/ui/page-header'
import { getCannedResponses } from '../actions'
import { CannedResponsesManager } from './canned-responses-manager'

export default async function CannedResponsesPage() {
  const result = await getCannedResponses()
  const responses = result.data || []

  return (
    <div>
      <PageHeader
        title="Canned Responses"
        subtitle={`${responses.length} responses`}
      />
      <CannedResponsesManager initialData={responses} />
    </div>
  )
}
