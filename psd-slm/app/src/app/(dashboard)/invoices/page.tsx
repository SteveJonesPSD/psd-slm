import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { getInvoices } from './actions'
import { InvoicesTable } from './invoices-table'

export default async function InvoicesPage() {
  await requirePermission('invoices', 'view')
  const invoices = await getInvoices()

  // Stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const outstanding = invoices.filter((i) => ['sent', 'overdue'].includes(i.effectiveStatus))
  const totalOutstanding = outstanding.reduce((sum: number, i: { total: number }) => sum + i.total, 0)
  const overdue = invoices.filter((i) => i.effectiveStatus === 'overdue')
  const overdueTotal = overdue.reduce((sum: number, i: { total: number }) => sum + i.total, 0)
  const paidThisMonth = invoices.filter(
    (i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart
  )
  const paidThisMonthTotal = paidThisMonth.reduce((sum: number, i: { total: number }) => sum + i.total, 0)
  const drafts = invoices.filter((i) => i.status === 'draft')

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Manage invoices raised from sales orders"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub={`${outstanding.length} invoices`}
          accent="#2563eb"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(overdueTotal)}
          sub={`${overdue.length} invoices`}
          accent="#dc2626"
        />
        <StatCard
          label="Paid This Month"
          value={formatCurrency(paidThisMonthTotal)}
          sub={`${paidThisMonth.length} invoices`}
          accent="#059669"
        />
        <StatCard
          label="Drafts"
          value={drafts.length}
          accent="#6b7280"
        />
      </div>

      <InvoicesTable invoices={invoices} />
    </div>
  )
}
