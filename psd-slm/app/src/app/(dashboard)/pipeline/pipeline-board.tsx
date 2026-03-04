'use client'

import React, { useState, useMemo, useCallback, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Column } from '@/components/ui/data-table'
import { StatCard } from '@/components/ui/stat-card'
import { Select, Input } from '@/components/ui/form-fields'
import { formatCurrency, formatDate } from '@/lib/utils'
import { OPPORTUNITY_STAGE_CONFIG, ACTIVE_STAGES, type OpportunityStage } from '@/lib/opportunities'
import { StageChangeModal } from './stage-change-modal'
import { LostReasonModal } from './lost-reason-modal'
import { changeStage, seedOpportunities } from './actions'
import type { Opportunity, Customer, User, Contact } from '@/types/database'
import type { AuthUser } from '@/lib/auth'

type UserPick = Pick<User, 'id' | 'first_name' | 'last_name' | 'initials' | 'color'>

interface PipelineBoardProps {
  opportunities: Opportunity[]
  customers: Pick<Customer, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'customer_id' | 'first_name' | 'last_name'>[]
  users: UserPick[]
  currentUser: AuthUser
}

type ViewMode = 'kanban' | 'list'

export function PipelineBoard({ opportunities, customers, contacts, users, currentUser }: PipelineBoardProps) {
  const router = useRouter()

  // Lookup maps
  const customerMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers])
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users])
  const contactMap = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, `${c.first_name} ${c.last_name}`])), [contacts])

  // View state
  const [view, setView] = useState<ViewMode>('kanban')

  // Filters
  const isSalesRole = currentUser.role.name === 'sales'
  const [assignedTo, setAssignedTo] = useState(isSalesRole ? currentUser.id : '')
  const [companySearch, setCompanySearch] = useState('')
  const [closeDateFrom, setCloseDateFrom] = useState('')
  const [closeDateTo, setCloseDateTo] = useState('')
  const [showWon, setShowWon] = useState(false)
  const [showLost, setShowLost] = useState(false)

  // Drag & drop state
  const [dragId, setDragId] = useState<string | null>(null)

  // Stage change modal
  const [stageModal, setStageModal] = useState<{
    id: string
    title: string
    fromStage: OpportunityStage
    toStage: OpportunityStage
  } | null>(null)

  // Lost reason modal
  const [lostModal, setLostModal] = useState<{
    id: string
    title: string
    fromStage: OpportunityStage
  } | null>(null)

  // List sort state
  const [sortKey, setSortKey] = useState<string>('expected_close_date')
  const [sortAsc, setSortAsc] = useState(true)

  // Seed state
  const [seeding, setSeeding] = useState(false)

  // Filter opportunities
  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (assignedTo && o.assigned_to !== assignedTo) return false
      if (companySearch) {
        const name = customerMap[o.customer_id] || ''
        if (!name.toLowerCase().includes(companySearch.toLowerCase())) return false
      }
      if (closeDateFrom && o.expected_close_date && o.expected_close_date < closeDateFrom) return false
      if (closeDateTo && o.expected_close_date && o.expected_close_date > closeDateTo) return false
      // Stage filtering
      if (o.stage === 'won' && !showWon) return false
      if (o.stage === 'lost' && !showLost) return false
      return true
    })
  }, [opportunities, assignedTo, companySearch, closeDateFrom, closeDateTo, showWon, showLost, customerMap])

  // Stats (active only)
  const activeFiltered = filtered.filter((o) => !['won', 'lost'].includes(o.stage))
  const totalPipeline = activeFiltered.reduce((s, o) => s + (o.estimated_value || 0), 0)
  const weightedValue = activeFiltered.reduce((s, o) => s + (o.estimated_value || 0) * (o.probability / 100), 0)
  const avgDealSize = activeFiltered.length > 0 ? totalPipeline / activeFiltered.length : 0

  // Drag handlers
  const handleDragStart = useCallback((e: DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: DragEvent, targetStage: OpportunityStage) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    if (!id) return
    setDragId(null)

    const opp = opportunities.find((o) => o.id === id)
    if (!opp || opp.stage === targetStage) return

    if (targetStage === 'lost') {
      setLostModal({ id, title: opp.title, fromStage: opp.stage as OpportunityStage })
    } else {
      setStageModal({
        id,
        title: opp.title,
        fromStage: opp.stage as OpportunityStage,
        toStage: targetStage,
      })
    }
  }, [dragId, opportunities])

  const handleStageConfirm = async (probability: number) => {
    if (!stageModal) return
    const result = await changeStage(stageModal.id, stageModal.toStage, probability)
    setStageModal(null)
    if (result && 'error' in result && result.error) {
      alert(result.error)
    }
    router.refresh()
  }

  const handleLostConfirm = async (reason: string, notes: string) => {
    if (!lostModal) return
    const result = await changeStage(lostModal.id, 'lost', 0, reason + (notes ? `\n${notes}` : ''))
    setLostModal(null)
    if (result && 'error' in result && result.error) {
      alert(result.error)
    }
    router.refresh()
  }

  const handleSeed = async () => {
    setSeeding(true)
    await seedOpportunities()
    setSeeding(false)
    router.refresh()
  }

  // Close date color coding: red if overdue, amber if ≤30 days, default otherwise
  const closeDateColor = (date: string | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const daysAway = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAway < 0) return 'text-red-600 font-semibold'
    if (daysAway <= 30) return 'text-amber-600 font-semibold'
    return ''
  }

  // Visible stages for kanban
  const kanbanStages: OpportunityStage[] = [
    ...ACTIVE_STAGES,
    ...(showWon ? ['won' as OpportunityStage] : []),
    ...(showLost ? ['lost' as OpportunityStage] : []),
  ]

  // User dropdown options
  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`,
  }))

  // Sort handler for list view
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  // Sorted list data
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortKey) {
        case 'title': aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); break
        case 'customer': aVal = (customerMap[a.customer_id] || '').toLowerCase(); bVal = (customerMap[b.customer_id] || '').toLowerCase(); break
        case 'contact': aVal = (a.contact_id ? contactMap[a.contact_id] || '' : '').toLowerCase(); bVal = (b.contact_id ? contactMap[b.contact_id] || '' : '').toLowerCase(); break
        case 'stage': aVal = a.stage; bVal = b.stage; break
        case 'estimated_value': aVal = a.estimated_value || 0; bVal = b.estimated_value || 0; break
        case 'probability': aVal = a.probability; bVal = b.probability; break
        case 'weighted': aVal = (a.estimated_value || 0) * a.probability / 100; bVal = (b.estimated_value || 0) * b.probability / 100; break
        case 'expected_close_date': aVal = a.expected_close_date || '9999'; bVal = b.expected_close_date || '9999'; break
        case 'updated_at': aVal = a.updated_at; bVal = b.updated_at; break
        default: break
      }
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortKey, sortAsc, customerMap, contactMap])

  // List view columns
  const listColumns: Column<Opportunity>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (r) => <span className="font-semibold">{r.title}</span>,
    },
    {
      key: 'customer',
      label: 'Company',
      render: (r) => customerMap[r.customer_id] || '\u2014',
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (r) => (r.contact_id ? contactMap[r.contact_id] : null) || '\u2014',
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (r) => {
        const cfg = OPPORTUNITY_STAGE_CONFIG[r.stage as OpportunityStage]
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
      render: (r) => `${r.probability}%`,
    },
    {
      key: 'weighted',
      label: 'Weighted',
      align: 'right',
      nowrap: true,
      render: (r) => formatCurrency((r.estimated_value || 0) * r.probability / 100),
    },
    {
      key: 'assigned',
      label: 'Owner',
      render: (r) => {
        const u = r.assigned_to ? userMap[r.assigned_to] : null
        return u ? <Avatar user={u} size={24} /> : null
      },
    },
    {
      key: 'expected_close_date',
      label: 'Close Date',
      nowrap: true,
      render: (r) =>
        r.expected_close_date ? (
          <span className={closeDateColor(r.expected_close_date)}>
            {formatDate(r.expected_close_date)}
          </span>
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      nowrap: true,
      render: (r) => formatDate(r.updated_at),
    },
  ]

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Pipeline Value" value={formatCurrency(totalPipeline)} accent="#6366f1" />
        <StatCard label="Weighted Value" value={formatCurrency(weightedValue)} accent="#059669" />
        <StatCard label="Active Deals" value={activeFiltered.length} accent="#d97706" />
        <StatCard
          label="Avg Deal Size"
          value={formatCurrency(avgDealSize)}
          accent="#0891b2"
        />
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <Select
          label="Assigned to"
          value={assignedTo}
          onChange={setAssignedTo}
          placeholder="All users"
          options={userOptions}
          className="w-full sm:w-48"
        />
        <Input
          label="Company"
          value={companySearch}
          onChange={setCompanySearch}
          placeholder="Search..."
          className="w-full sm:w-40"
        />
        <Input
          label="Close from"
          type="date"
          value={closeDateFrom}
          onChange={setCloseDateFrom}
          className="w-full sm:w-40"
        />
        <Input
          label="Close to"
          type="date"
          value={closeDateTo}
          onChange={setCloseDateTo}
          className="w-full sm:w-40"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showWon}
              onChange={(e) => setShowWon(e.target.checked)}
              className="rounded border-slate-300"
            />
            Won
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showLost}
              onChange={(e) => setShowLost(e.target.checked)}
              className="rounded border-slate-300"
            />
            Lost
          </label>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-2">
            <button
              onClick={() => setView('kanban')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'kanban' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="Kanban view"
            >
              &#9634;&#9634;
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="List view"
            >
              &#9776;
            </button>
          </div>
        </div>
      </div>

      {/* Board / List */}
      {opportunities.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400 mb-4">No opportunities yet. Add seed data to get started.</p>
          <Button variant="primary" onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Seeding...' : 'Seed Opportunities'}
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${kanbanStages.length}, minmax(240px, 1fr))` }}
        >
          {kanbanStages.map((stage) => {
            const cfg = OPPORTUNITY_STAGE_CONFIG[stage]
            const stageOpps = filtered.filter((o) => o.stage === stage)
            const total = stageOpps.reduce((s, o) => s + (o.estimated_value || 0), 0)

            return (
              <div
                key={stage}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden min-w-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Stage header */}
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `3px solid ${cfg.color}` }}
                >
                  <div className="text-sm font-semibold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </div>
                  <div className="text-xs text-slate-400">
                    {stageOpps.length} &middot; {formatCurrency(total)}
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-1 min-h-[80px]">
                  {stageOpps.map((o) => {
                    const owner = o.assigned_to ? userMap[o.assigned_to] : null
                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, o.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => router.push(`/opportunities/${o.id}`)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          dragId === o.id
                            ? 'border-slate-300 opacity-50'
                            : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate pr-2">
                            {o.title}
                          </span>
                          {owner && <Avatar user={owner} size={22} />}
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span className="truncate">
                            {customerMap[o.customer_id] || ''}
                          </span>
                          <span className="font-semibold text-slate-700 shrink-0">
                            {formatCurrency(o.estimated_value || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{o.probability}%</span>
                          {o.expected_close_date && (
                            <span className={closeDateColor(o.expected_close_date)}>
                              {formatDate(o.expected_close_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {stageOpps.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      ) : sortedFiltered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-400">
          No opportunities match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {listColumns.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:text-slate-700 select-none"
                    style={{ textAlign: col.align || 'left' }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}{' '}
                    {sortKey === col.key ? (
                      <span className="text-slate-800">{sortAsc ? '\u25B2' : '\u25BC'}</span>
                    ) : (
                      <span className="text-slate-300">\u25B4</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/opportunities/${row.id}`)}
                  className="border-b border-slate-100 text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                  {listColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 ${col.nowrap ? 'whitespace-nowrap' : ''}`}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(row) : (row as unknown as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stage change modal */}
      {stageModal && (
        <StageChangeModal
          opportunityTitle={stageModal.title}
          fromStage={stageModal.fromStage}
          toStage={stageModal.toStage}
          onConfirm={handleStageConfirm}
          onClose={() => setStageModal(null)}
        />
      )}

      {/* Lost reason modal */}
      {lostModal && (
        <LostReasonModal
          opportunityTitle={lostModal.title}
          onConfirm={handleLostConfirm}
          onClose={() => setLostModal(null)}
        />
      )}
    </div>
  )
}
