'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getMarginColor, DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER } from '@/lib/margin'
import { deleteQuote, createRevision, duplicateQuote, manuallyAcceptQuote } from '../actions'
import { LOST_REASONS } from '@/lib/opportunities'
import type { Quote, User } from '@/types/database'

interface LineRow {
  id: string
  group_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: string
  is_optional: boolean
  requires_contract: boolean
  deal_reg_line_id: string | null
  notes: string | null
  product_id: string | null
  products: { name: string; sku: string } | null
  suppliers: { name: string } | null
}

interface GroupRow {
  id: string
  name: string
  sort_order: number
}

interface Attribution {
  id: string
  attribution_type: string
  split_pct: number
  users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

interface MobileQuoteDetailProps {
  quote: Quote
  customer: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string; email: string | null } | null
  assignedUser: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
  allLines: LineRow[]
  groups: GroupRow[]
  attributions: Attribution[]
  opportunity: { id: string; title: string } | null
  brand: { id: string; name: string; logo_path: string | null } | null
  portalUrl: string | null
  existingSoId: string | null
  subtotal: number
  totalCost: number
  marginAmt: number
  marginPct: number
  vatAmount: number
  grandTotal: number
  customerNotes: string | null
  internalNotes: string | null
  marginThresholds?: { green: number; amber: number }
}

type Tab = 'overview' | 'lines' | 'notes' | 'actions'

export function MobileQuoteDetail({
  quote,
  customer,
  contact,
  assignedUser,
  allLines,
  groups,
  attributions,
  opportunity,
  brand,
  portalUrl,
  existingSoId,
  subtotal,
  totalCost,
  marginAmt,
  marginPct,
  vatAmount,
  grandTotal,
  customerNotes,
  internalNotes,
  marginThresholds,
}: MobileQuoteDetailProps) {
  const greenT = marginThresholds?.green ?? DEFAULT_MARGIN_GREEN
  const amberT = marginThresholds?.amber ?? DEFAULT_MARGIN_AMBER
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showLineDetail, setShowLineDetail] = useState<LineRow | null>(null)
  const [acting, setActing] = useState(false)

  // Action modals
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [mobileRevisionNotes, setMobileRevisionNotes] = useState('')
  const [showLostModal, setShowLostModal] = useState(false)
  const [acceptPo, setAcceptPo] = useState('')
  const [lostReason, setLostReason] = useState('')

  const canEdit = hasPermission('quotes', 'edit_all') || hasPermission('quotes', 'edit_own')
  const canDelete = hasPermission('quotes', 'delete')
  const canCreate = hasPermission('quotes', 'create')

  const statusCfg = QUOTE_STATUS_CONFIG[quote.status as keyof typeof QUOTE_STATUS_CONFIG]
  const typeCfg = quote.quote_type ? QUOTE_TYPE_CONFIG[quote.quote_type as keyof typeof QUOTE_TYPE_CONFIG] : null

  // Group lines
  const groupedLines = groups.map(g => ({
    ...g,
    lines: allLines.filter(l => l.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order),
  }))
  const ungroupedLines = allLines.filter(l => !l.group_id)
  const nonOptionalLines = allLines.filter(l => !l.is_optional)

  const handleEdit = useCallback(async () => {
    if (['draft', 'review'].includes(quote.status)) {
      router.push(`/quotes/${quote.id}/edit`)
    } else if (['sent', 'declined'].includes(quote.status) && canCreate) {
      setShowRevisionModal(true)
    }
  }, [quote, router, canCreate])

  const handleConfirmRevision = useCallback(async () => {
    setActing(true)
    const result = await createRevision(quote.id, mobileRevisionNotes)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      setShowRevisionModal(false)
      setMobileRevisionNotes('')
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }, [quote.id, router, mobileRevisionNotes])

  const handleDuplicate = useCallback(async () => {
    setActing(true)
    const result = await duplicateQuote(quote.id)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }, [quote.id, router])

  const handleAccept = useCallback(async () => {
    setActing(true)
    const result = await manuallyAcceptQuote(quote.id, acceptPo.trim() || undefined)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowAcceptModal(false)
      router.refresh()
    }
  }, [quote.id, acceptPo, router])

  const handleDelete = useCallback(async () => {
    setActing(true)
    const result = await deleteQuote(quote.id)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.push('/quotes')
    }
  }, [quote.id, router])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      key: 'lines',
      label: 'Lines',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="pb-20">
      {/* Back + header */}
      <div className="mb-4">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 no-underline mb-3"
        >
          &larr; Quotes
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{quote.quote_number}</h1>
              {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            </div>
            {quote.title && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-0.5">{quote.title}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-500 dark:text-slate-400">
              {customer && (
                <Link href={`/customers/${customer.id}`} className="hover:text-slate-700 dark:hover:text-slate-300 no-underline">
                  {customer.name}
                </Link>
              )}
              {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
              {quote.version > 1 && <Badge label={`v${quote.version}`} color="#6b7280" bg="#f3f4f6" />}
            </div>
          </div>
          {assignedUser && (
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: assignedUser.color || '#6366f1' }}
              title={`${assignedUser.first_name} ${assignedUser.last_name}`}
            >
              {assignedUser.initials || '?'}
            </span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MiniStat label="Total" value={formatCurrency(grandTotal)} accent="#6366f1" />
        <MiniStat label="Subtotal" value={formatCurrency(subtotal)} accent="#1e293b" />
        <MiniStat
          label="Margin"
          value={`${formatCurrency(marginAmt)} (${marginPct.toFixed(1)}%)`}
          accent={marginPct >= greenT ? '#059669' : marginPct >= amberT ? '#d97706' : '#dc2626'}
        />
        <MiniStat label="VAT" value={`${formatCurrency(vatAmount)} (${quote.vat_rate}%)`} accent="#6b7280" />
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Details card */}
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <MobileField label="Created" value={formatDate(quote.created_at)} />
              <MobileField label="Valid Until" value={quote.valid_until ? formatDate(quote.valid_until) : null} />
              {quote.sent_at && <MobileField label="Sent" value={formatDate(quote.sent_at)} />}
              {quote.accepted_at && <MobileField label="Accepted" value={formatDate(quote.accepted_at)} />}
              <MobileField label="Lines" value={`${allLines.length} (${nonOptionalLines.length} firm)`} />
              {contact && <MobileField label="Contact" value={`${contact.first_name} ${contact.last_name}`} />}
              {opportunity && <MobileField label="Opportunity" value={opportunity.title} />}
              {brand && <MobileField label="Brand" value={brand.name} />}
              {quote.customer_po && <MobileField label="Customer PO" value={quote.customer_po} />}
            </div>
          </div>

          {/* Attribution card */}
          {attributions.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Sales Attribution</h3>
              <div className="space-y-2">
                {attributions.map(a => {
                  const u = a.users
                  return (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {u && (
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                            style={{ backgroundColor: u.color || '#6366f1' }}
                          >
                            {u.initials || '?'}
                          </span>
                        )}
                        <span className="text-slate-700 dark:text-slate-300">{u ? `${u.first_name} ${u.last_name}` : 'Unknown'}</span>
                        <Badge
                          label={a.attribution_type}
                          color={a.attribution_type === 'direct' ? '#059669' : a.attribution_type === 'override' ? '#d97706' : '#6b7280'}
                          bg={a.attribution_type === 'direct' ? '#ecfdf5' : a.attribution_type === 'override' ? '#fffbeb' : '#f3f4f6'}
                        />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">{a.split_pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Portal link */}
          {portalUrl && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20 p-4">
              <h3 className="text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1.5">Customer Portal</h3>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 dark:text-purple-400 underline break-all">{portalUrl}</a>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lines' && (
        <div className="space-y-3">
          {groupedLines.map(group => (
            <div key={group.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.name}</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">({group.lines.length})</span>
              </div>
              <div className="space-y-1.5">
                {group.lines.map(line => (
                  <LineCard key={line.id} line={line} onTap={() => setShowLineDetail(line)} greenT={greenT} amberT={amberT} />
                ))}
              </div>
            </div>
          ))}

          {ungroupedLines.length > 0 && (
            <div>
              <div className="mb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ungrouped</h3>
              </div>
              <div className="space-y-1.5">
                {ungroupedLines.map(line => (
                  <LineCard key={line.id} line={line} onTap={() => setShowLineDetail(line)} greenT={greenT} amberT={amberT} />
                ))}
              </div>
            </div>
          )}

          {allLines.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No line items.</div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          {customerNotes ? (
            <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 p-4">
              <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">Customer Notes</h3>
              <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{customerNotes}</p>
            </div>
          ) : null}

          {internalNotes ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 p-4">
              <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">Internal Notes</h3>
              <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{internalNotes}</p>
            </div>
          ) : null}

          {!customerNotes && !internalNotes && (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No notes on this quote.</div>
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="space-y-3">
          {/* Primary actions */}
          {canEdit && ['draft', 'review', 'sent', 'declined'].includes(quote.status) && (
            <ActionButton
              label={['sent', 'declined'].includes(quote.status) ? 'Create Revision & Edit' : 'Edit Quote'}
              icon={<PencilIcon />}
              color="indigo"
              onClick={handleEdit}
            />
          )}

          {canEdit && ['draft', 'review'].includes(quote.status) && (
            <ActionButton
              label="Send to Customer"
              icon={<SendIcon />}
              color="blue"
              onClick={() => router.push(`/quotes/${quote.id}`)}
              subtitle="Open desktop view to send"
            />
          )}

          {canEdit && quote.status === 'sent' && (
            <ActionButton
              label="Accept Quote"
              icon={<CheckIcon />}
              color="green"
              onClick={() => setShowAcceptModal(true)}
            />
          )}

          {canEdit && quote.status === 'accepted' && quote.acknowledged_at && !existingSoId && (
            <ActionButton
              label="Create Sales Order"
              icon={<DocumentIcon />}
              color="blue"
              onClick={() => router.push(`/orders/new?quote_id=${quote.id}`)}
            />
          )}

          {quote.status === 'accepted' && existingSoId && (
            <ActionButton
              label="View Sales Order"
              icon={<DocumentIcon />}
              color="blue"
              onClick={() => router.push(`/orders/${existingSoId}`)}
            />
          )}

          {/* PDF */}
          <ActionButton
            label="Download PDF"
            icon={<PdfIcon />}
            color="slate"
            onClick={() => window.open(`/api/quotes/${quote.id}/pdf`, '_blank')}
          />

          {/* Secondary actions */}
          {canCreate && (
            <ActionButton
              label="Duplicate Quote"
              icon={<CopyIcon />}
              color="slate"
              onClick={handleDuplicate}
              disabled={acting}
            />
          )}

          {canEdit && quote.status === 'sent' && (
            <ActionButton
              label="Mark as Lost"
              icon={<XIcon />}
              color="red"
              onClick={() => { setLostReason(''); setShowLostModal(true) }}
            />
          )}

          {canDelete && quote.status === 'draft' && (
            <ActionButton
              label="Delete Quote"
              icon={<TrashIcon />}
              color="red"
              onClick={() => setShowDeleteModal(true)}
            />
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line detail sheet */}
      <BottomSheet open={!!showLineDetail} onClose={() => setShowLineDetail(null)} title={showLineDetail?.description || 'Line Detail'}>
        {showLineDetail && <LineDetailContent line={showLineDetail} greenT={greenT} amberT={amberT} />}
      </BottomSheet>

      {/* Accept modal */}
      {showAcceptModal && (
        <Modal title="Accept Quote" onClose={() => setShowAcceptModal(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Mark <strong className="text-slate-900 dark:text-white">{quote.quote_number}</strong> as accepted.
          </p>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Customer PO <span className="text-xs text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={acceptPo}
            onChange={(e) => setAcceptPo(e.target.value)}
            placeholder="e.g. PO-12345"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowAcceptModal(false)}>Cancel</Button>
            <Button size="sm" variant="success" onClick={handleAccept} disabled={acting}>
              {acting ? 'Accepting...' : 'Accept'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Revision modal */}
      {showRevisionModal && (
        <Modal title="Create Revision" onClose={() => { setShowRevisionModal(false); setMobileRevisionNotes('') }}>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            This will create a new revision (v{quote.version + 1}) and mark the current version as revised.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Revision Notes <span className="text-xs text-slate-400">(optional)</span>
            </label>
            <textarea
              value={mobileRevisionNotes}
              onChange={(e) => setMobileRevisionNotes(e.target.value)}
              placeholder="Why is this revision being created?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => { setShowRevisionModal(false); setMobileRevisionNotes('') }}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={handleConfirmRevision} disabled={acting}>
              {acting ? 'Creating...' : 'Create & Edit'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <Modal title="Delete Quote" onClose={() => setShowDeleteModal(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Delete <strong className="text-slate-900 dark:text-white">{quote.quote_number}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={acting}>
              {acting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Lost modal */}
      {showLostModal && (
        <Modal title="Mark as Lost" onClose={() => setShowLostModal(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Mark <strong className="text-slate-900 dark:text-white">{quote.quote_number}</strong> as lost?
          </p>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason</label>
          <select
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 mb-4"
          >
            <option value="">Select a reason...</option>
            {LOST_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowLostModal(false)}>Cancel</Button>
            <Button size="sm" variant="danger" disabled={!lostReason || acting} onClick={async () => {
              setActing(true)
              const { markQuoteAsLost } = await import('../actions')
              await markQuoteAsLost(quote.id, lostReason)
              setActing(false)
              setShowLostModal(false)
              router.refresh()
            }}>
              Mark as Lost
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-bold" style={{ color: accent }}>{value}</div>
    </div>
  )
}

function MobileField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-700 dark:text-slate-300">{value || '\u2014'}</div>
    </div>
  )
}

function LineCard({ line, onTap, greenT, amberT }: { line: LineRow; onTap: () => void; greenT?: number; amberT?: number }) {
  const lineTotal = line.quantity * line.sell_price
  const marginPct = line.sell_price > 0 ? ((line.sell_price - line.buy_price) / line.sell_price) * 100 : 0
  const mColor = getMarginColor(line.buy_price, line.sell_price, greenT, amberT)

  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-xl border p-3 transition-colors active:bg-gray-50 dark:active:bg-slate-700 ${
        line.is_optional
          ? 'border-dashed border-gray-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-sm leading-snug ${line.is_optional ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-slate-900 dark:text-white'}`}>
          {line.description}
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">{formatCurrency(lineTotal)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{line.quantity} x {formatCurrency(line.sell_price)}</span>
        {line.sell_price > 0 && <span className={`font-medium ${mColor}`}>{marginPct.toFixed(1)}%</span>}
        {line.products?.sku && <span className="font-mono text-slate-400 dark:text-slate-500">{line.products.sku}</span>}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {line.is_optional && <Badge label="Optional" color="#6b7280" bg="#f3f4f6" />}
        {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
        {line.deal_reg_line_id && <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />}
      </div>
    </button>
  )
}

function LineDetailContent({ line, greenT, amberT }: { line: LineRow; greenT?: number; amberT?: number }) {
  const lineTotal = line.quantity * line.sell_price
  const lineCost = line.quantity * line.buy_price
  const marginAmt = lineTotal - lineCost
  const marginPct = line.sell_price > 0 ? ((line.sell_price - line.buy_price) / line.sell_price) * 100 : 0
  const mColor = getMarginColor(line.buy_price, line.sell_price, greenT, amberT)
  const routeCfg = FULFILMENT_ROUTE_CONFIG?.[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MobileField label="Quantity" value={line.quantity} />
        <MobileField label="Buy Price" value={formatCurrency(line.buy_price)} />
        <MobileField label="Sell Price" value={formatCurrency(line.sell_price)} />
        <MobileField label="Line Total" value={formatCurrency(lineTotal)} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Margin:</span>
        <span className={`font-semibold ${mColor}`}>{formatCurrency(marginAmt)} ({marginPct.toFixed(1)}%)</span>
      </div>
      {line.products?.sku && <MobileField label="SKU" value={line.products.sku} />}
      {line.suppliers?.name && <MobileField label="Supplier" value={line.suppliers.name} />}
      {routeCfg && (
        <div>
          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Route</div>
          <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
        </div>
      )}
      {line.notes && <MobileField label="Notes" value={line.notes} />}
      <div className="flex flex-wrap gap-1.5">
        {line.is_optional && <Badge label="Optional" color="#6b7280" bg="#f3f4f6" />}
        {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
        {line.deal_reg_line_id && <Badge label="Deal Reg" color="#7c3aed" bg="#f5f3ff" />}
      </div>
    </div>
  )
}

function ActionButton({ label, icon, color, onClick, disabled, subtitle }: {
  label: string; icon: React.ReactNode; color: string; onClick: () => void; disabled?: boolean; subtitle?: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 active:bg-indigo-100',
    blue: 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 active:bg-blue-100',
    green: 'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 active:bg-emerald-100',
    red: 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 active:bg-red-100',
    slate: 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:bg-gray-50',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50 ${colorMap[color] || colorMap.slate}`}
    >
      <span className="shrink-0">{icon}</span>
      <div>
        <span className="text-sm font-medium">{label}</span>
        {subtitle && <span className="block text-xs opacity-60">{subtitle}</span>}
      </div>
    </button>
  )
}

// Icons
function PencilIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
