import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, STOCK_TAKE_STATUS_CONFIG } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getStockTakes } from '../actions'

export default async function StockTakesPage() {
  await requirePermission('stock', 'view')
  const stockTakes = await getStockTakes()

  type StRow = typeof stockTakes[number]

  const columns: Column<StRow>[] = [
    {
      key: 'st_number',
      label: 'ST #',
      nowrap: true,
      render: (r: StRow) => <span className="font-semibold">{r.st_number}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      nowrap: true,
      render: (r: StRow) => {
        const loc = r.stock_locations as unknown as { name: string; code: string } | null
        return loc ? `${loc.name} (${loc.code})` : '\u2014'
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r: StRow) => {
        const cfg = STOCK_TAKE_STATUS_CONFIG[r.status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r: StRow) => {
        const lines = r.stock_take_lines as unknown as { id: string }[]
        return lines?.length || 0
      },
    },
    {
      key: 'started_by',
      label: 'Started By',
      nowrap: true,
      render: (r: StRow) => {
        const u = r.starter as unknown as { first_name: string; last_name: string } | null
        return u ? `${u.first_name} ${u.last_name}` : '\u2014'
      },
    },
    {
      key: 'created',
      label: 'Created',
      nowrap: true,
      render: (r: StRow) => formatDate(r.created_at),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Stock Takes"
        subtitle="Periodic stock counting and reconciliation"
      />

      <div className="flex justify-end mb-4">
        <Link
          href="/stock/takes/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-indigo-700"
        >
          + New Stock Take
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={stockTakes}
        onRowClick={(r) => `/stock/takes/${r.id}`}
        emptyMessage="No stock takes found."
      />
    </div>
  )
}
