import { PageHeader } from '@/components/ui/page-header'
import { getOrgUsers } from '@/lib/audit-log'
import { AuditLogClient } from './audit-log-client'

export default async function AuditLogPage() {
  const users = await getOrgUsers()

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="System-wide activity and authentication history"
      />
      <AuditLogClient users={users} />
    </div>
  )
}
