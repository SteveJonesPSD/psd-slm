import { requirePortalSession } from '@/lib/portal/session'
import { getPortalContacts } from '@/lib/portal/contacts-actions'
import { PortalContactsClient } from './portal-contacts-client'

export default async function PortalContactsPage() {
  const ctx = await requirePortalSession()
  const contacts = await getPortalContacts(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ctx.isPortalAdmin
            ? 'Manage portal access for your team'
            : 'Your team contacts'}
        </p>
      </div>

      <PortalContactsClient contacts={contacts} isAdmin={ctx.isPortalAdmin} />
    </div>
  )
}
