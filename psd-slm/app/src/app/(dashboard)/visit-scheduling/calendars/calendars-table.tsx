'use client'

import { useRouter } from 'next/navigation'
import { Badge, CALENDAR_STATUS_CONFIG } from '@/components/ui/badge'
import { DataTable, Column } from '@/components/ui/data-table'
import type { VisitCalendar } from '@/lib/visit-scheduling/types'
import { formatVisitDate, getDateYear } from '@/lib/visit-scheduling/types'

interface CalendarsTableProps {
  calendars: VisitCalendar[]
}

export function CalendarsTable({ calendars }: CalendarsTableProps) {
  const router = useRouter()

  const columns: Column<VisitCalendar>[] = [
    { key: 'name', label: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    {
      key: 'academic_year_start',
      label: 'Academic Year',
      nowrap: true,
      render: (row) => {
        const sy = getDateYear(row.academic_year_start)
        const ey = getDateYear(row.academic_year_end)
        return sy && ey ? `${sy}/${ey}` : '—'
      },
    },
    {
      key: 'academic_year_end',
      label: 'Start',
      nowrap: true,
      render: (row) => formatVisitDate(row.academic_year_start),
    },
    {
      key: 'schedule_weeks',
      label: 'End',
      nowrap: true,
      render: (row) => formatVisitDate(row.academic_year_end),
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (row) => {
        const cfg = CALENDAR_STATUS_CONFIG[row.status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : row.status
      },
    },
    { key: 'notes', label: 'Weeks', nowrap: true, render: (row) => `${row.schedule_weeks ?? '—'}` },
  ]

  return (
    <DataTable
      columns={columns}
      data={calendars}
      onRowClick={(row) => router.push(`/visit-scheduling/calendars/${row.id}`)}
      emptyMessage="No calendars found. Create one to get started."
    />
  )
}
