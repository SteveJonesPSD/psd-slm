import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { getDeliveryNotes } from './actions'
import { DeliveryNotesTable } from './delivery-notes-table'

export default async function DeliveryNotesPage() {
  await requirePermission('delivery_notes', 'view')
  const deliveryNotes = await getDeliveryNotes()

  const draft = deliveryNotes.filter(d => d.status === 'draft').length
  const dispatched = deliveryNotes.filter(d => d.status === 'dispatched').length
  const delivered = deliveryNotes.filter(d => d.status === 'delivered').length
  const thisMonth = deliveryNotes.filter(d => {
    const created = new Date(d.created_at)
    const now = new Date()
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
  }).length

  return (
    <div>
      <PageHeader
        title="Delivery Notes"
        subtitle="Track dispatches and deliveries"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Draft" value={draft} accent="#6b7280" />
        <StatCard label="Dispatched" value={dispatched} accent="#6366f1" />
        <StatCard label="Delivered" value={delivered} accent="#059669" />
        <StatCard label="This Month" value={thisMonth} accent="#2563eb" />
      </div>

      <DeliveryNotesTable deliveryNotes={deliveryNotes} />
    </div>
  )
}
