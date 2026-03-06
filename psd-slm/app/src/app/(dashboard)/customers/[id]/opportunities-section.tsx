'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, STAGE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { CollapsibleCard } from './collapsible-card'

interface OppRow {
  id: string
  title: string
  stage: string
  estimated_value: number | null
  probability: number
  expected_close_date: string | null
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

interface OpportunitiesSectionProps {
  opportunities: OppRow[]
  customerId: string
}

export function OpportunitiesSection({ opportunities, customerId }: OpportunitiesSectionProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()

  const columns: Column<OppRow>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (r) => <span className="font-semibold">{r.title}</span>,
    },
    {
      key: 'assigned',
      label: 'Owner',
      render: (r) =>
        r.users ? (
          <Avatar
            user={{
              first_name: r.users.first_name,
              last_name: r.users.last_name,
              initials: r.users.initials,
              color: r.users.color,
            }}
            size={24}
          />
        ) : null,
    },
    {
      key: 'stage',
      label: 'Stage',
      nowrap: true,
      render: (r) => {
        const cfg = STAGE_CONFIG[r.stage as keyof typeof STAGE_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.stage
      },
    },
    {
      key: 'estimated_value',
      label: 'Value',
      align: 'right',
      nowrap: true,
      render: (r) => formatCurrency(r.estimated_value || 0),
    },
    {
      key: 'probability',
      label: 'Prob.',
      align: 'center',
      nowrap: true,
      render: (r) => `${r.probability}%`,
    },
    {
      key: 'expected_close_date',
      label: 'Close Date',
      nowrap: true,
      render: (r) => r.expected_close_date || '\u2014',
    },
  ]

  return (
    <CollapsibleCard
      title="Opportunities"
      count={opportunities.length}
      actions={
        hasPermission('pipeline', 'create') ? (
          <Link href={`/opportunities/new?company_id=${customerId}`}>
            <Button size="sm" variant="primary">+ New Opportunity</Button>
          </Link>
        ) : undefined
      }
    >
      <DataTable
        columns={columns}
        data={opportunities}
        onRowClick={(r) => router.push(`/opportunities/${r.id}`)}
        emptyMessage="No opportunities yet."
      />
    </CollapsibleCard>
  )
}
