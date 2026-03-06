'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

interface SearchPreviewProps {
  customerId: string
  type: string
  entityId: string
  href: string
  onClose: () => void
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: '#64748b', bg: '#f1f5f9' },
  sent: { color: '#2563eb', bg: '#eff6ff' },
  accepted: { color: '#059669', bg: '#ecfdf5' },
  declined: { color: '#dc2626', bg: '#fef2f2' },
  pending: { color: '#d97706', bg: '#fffbeb' },
  confirmed: { color: '#2563eb', bg: '#eff6ff' },
  in_progress: { color: '#6366f1', bg: '#eef2ff' },
  fulfilled: { color: '#059669', bg: '#ecfdf5' },
  cancelled: { color: '#64748b', bg: '#f1f5f9' },
  new: { color: '#6366f1', bg: '#eef2ff' },
  open: { color: '#2563eb', bg: '#eff6ff' },
  resolved: { color: '#059669', bg: '#ecfdf5' },
  closed: { color: '#64748b', bg: '#f1f5f9' },
  paid: { color: '#059669', bg: '#ecfdf5' },
  overdue: { color: '#dc2626', bg: '#fef2f2' },
  void: { color: '#64748b', bg: '#f1f5f9' },
  active: { color: '#059669', bg: '#ecfdf5' },
  expired: { color: '#64748b', bg: '#f1f5f9' },
  scheduled: { color: '#2563eb', bg: '#eff6ff' },
  completed: { color: '#059669', bg: '#ecfdf5' },
  partially_fulfilled: { color: '#d97706', bg: '#fffbeb' },
  partially_received: { color: '#d97706', bg: '#fffbeb' },
  received: { color: '#059669', bg: '#ecfdf5' },
  waiting_on_customer: { color: '#d97706', bg: '#fffbeb' },
}

function fmt(val: number | string | null | undefined): string {
  if (val == null) return '-'
  return `\u00A3${Number(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('en-GB')
}

function fmtDateTime(val: string | null | undefined): string {
  if (!val) return '-'
  return new Date(val).toLocaleString('en-GB')
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const sc = STATUS_COLORS[status]
  const ticketCfg = TICKET_STATUS_CONFIG[status]
  const label = ticketCfg?.label || status.replace(/_/g, ' ')
  return <Badge label={label} color={sc?.color || '#64748b'} bg={sc?.bg || '#f1f5f9'} />
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-') return null
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-slate-700 dark:text-slate-300 font-medium text-right max-w-[280px] truncate">{value}</span>
    </div>
  )
}

export function SearchPreviewPanel({ customerId, type, entityId, href, onClose }: SearchPreviewProps) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDetail(null)

    fetch(`/api/customers/${customerId}/search/detail?type=${encodeURIComponent(type)}&entityId=${encodeURIComponent(entityId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        if (!cancelled) setDetail(data.detail)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load preview')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [customerId, type, entityId])

  return (
    <div className="absolute z-50 right-0 top-0 w-[480px] max-h-[520px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{type} Preview</h4>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 no-underline"
          >
            Open full page &rarr;
          </Link>
          <button
            onClick={onClose}
            className="ml-1 rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          </div>
        )}
        {error && <div className="text-center py-8 text-sm text-red-500">{error}</div>}
        {detail && !loading && renderDetail(type, detail)}
      </div>
    </div>
  )
}

function renderDetail(type: string, d: Record<string, unknown>) {
  switch (type) {
    case 'Sales Order': return <SalesOrderPreview d={d} />
    case 'Ticket': return <TicketPreview d={d} />
    case 'Quote': return <QuotePreview d={d} />
    case 'Invoice': return <InvoicePreview d={d} />
    case 'Job': return <JobPreview d={d} />
    case 'Purchase Order': return <PurchaseOrderPreview d={d} />
    case 'Contact': return <ContactPreview d={d} />
    case 'Opportunity': return <OpportunityPreview d={d} />
    case 'Contract': return <ContractPreview d={d} />
    case 'Deal Reg': return <DealRegPreview d={d} />
    default: return <pre className="text-xs">{JSON.stringify(d, null, 2)}</pre>
  }
}

// --- Shared line table ---
function LineTable({ lines, priceKey = 'sell_price' }: { lines: Record<string, unknown>[]; priceKey?: string }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-slate-400 dark:text-slate-500">
          <th className="pb-1 font-medium">Description</th>
          <th className="pb-1 font-medium text-right">Qty</th>
          <th className="pb-1 font-medium text-right">Price</th>
          <th className="pb-1 font-medium text-right">Total</th>
        </tr>
      </thead>
      <tbody className="text-slate-700 dark:text-slate-300">
        {lines.map((l, i) => {
          const price = Number(l[priceKey] ?? 0)
          const qty = Number(l.quantity ?? 0)
          const product = l.products as Record<string, unknown> | null
          const desc = (l.description as string) || (product?.name as string) || '-'
          return (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
              <td className="py-1.5 pr-2 max-w-[200px] truncate">{desc}</td>
              <td className="py-1.5 text-right">{qty}</td>
              <td className="py-1.5 text-right">{fmt(price)}</td>
              <td className="py-1.5 text-right">{fmt(price * qty)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// --- Sales Order ---
function SalesOrderPreview({ d }: { d: Record<string, unknown> }) {
  const lines = (d.lines as Record<string, unknown>[]) || []
  const total = lines.reduce((sum, l) => sum + (Number(l.sell_price) || 0) * (Number(l.quantity) || 0), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.so_number as string}</span>
        <StatusBadge status={d.status as string} />
      </div>
      <MetaRow label="Customer PO" value={d.customer_po as string} />
      <MetaRow label="Created" value={fmtDateTime(d.created_at as string)} />
      {lines.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Lines ({lines.length})</h5>
          <LineTable lines={lines} priceKey="sell_price" />
          <div className="border-t border-slate-200 dark:border-slate-600 mt-1 pt-1 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
            Total: {fmt(total)}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Ticket ---
function TicketPreview({ d }: { d: Record<string, unknown> }) {
  const messages = (d.messages as Record<string, unknown>[]) || []
  const assignee = d.assignee as Record<string, unknown> | null
  const priorityCfg = TICKET_PRIORITY_CONFIG[d.priority as string]
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.ticket_number as string}</span>
        <StatusBadge status={d.status as string} />
        {priorityCfg ? <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} /> : null}
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300">{d.subject as string}</p>
      {assignee ? <MetaRow label="Assigned" value={`${assignee.first_name} ${assignee.last_name}`} /> : null}
      <MetaRow label="Created" value={fmtDateTime(d.created_at as string)} />
      {messages.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Thread ({messages.length}{messages.length >= 10 ? '+' : ''})
          </h5>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {messages.map((m, i) => {
              const sender = m.sender as Record<string, unknown> | null
              const senderName = sender ? `${sender.first_name} ${sender.last_name}` : (m.sender_type === 'system' ? 'System' : 'Customer')
              const isInternal = m.is_internal as boolean
              return (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    m.sender_type === 'agent'
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800'
                      : m.sender_type === 'system'
                        ? 'bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{senderName}</span>
                    {isInternal ? <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Internal</span> : null}
                    <span className="ml-auto text-slate-400 dark:text-slate-500">{fmtDateTime(m.created_at as string)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap">{m.body as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Quote ---
function QuotePreview({ d }: { d: Record<string, unknown> }) {
  const lines = (d.lines as Record<string, unknown>[]) || []
  const total = lines.reduce((sum, l) => sum + (Number(l.sell_price) || 0) * (Number(l.quantity) || 0), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.quote_number as string}</span>
        <StatusBadge status={d.status as string} />
      </div>
      {d.title ? <p className="text-sm text-slate-600 dark:text-slate-400">{d.title as string}</p> : null}
      {d.customer_po ? <MetaRow label="Customer PO" value={d.customer_po as string} /> : null}
      {d.quote_type ? <MetaRow label="Type" value={(d.quote_type as string).replace(/_/g, ' ')} /> : null}
      <MetaRow label="Valid Until" value={fmtDate(d.valid_until as string)} />
      <MetaRow label="Created" value={fmtDateTime(d.created_at as string)} />
      {lines.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Lines ({lines.length})</h5>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-slate-500">
                <th className="pb-1 font-medium">Description</th>
                <th className="pb-1 font-medium text-right">Qty</th>
                <th className="pb-1 font-medium text-right">Price</th>
                <th className="pb-1 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {lines.map((l, i) => (
                <tr key={i} className={`border-t border-slate-100 dark:border-slate-700 ${(l.is_optional as boolean) ? 'opacity-50' : ''}`}>
                  <td className="py-1.5 pr-2 max-w-[200px] truncate">
                    {l.description as string}
                    {(l.is_optional as boolean) ? <span className="ml-1 text-[10px] text-slate-400">(opt)</span> : null}
                  </td>
                  <td className="py-1.5 text-right">{l.quantity as number}</td>
                  <td className="py-1.5 text-right">{fmt(l.sell_price as number)}</td>
                  <td className="py-1.5 text-right">{fmt((Number(l.sell_price) || 0) * (Number(l.quantity) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200 dark:border-slate-600 mt-1 pt-1 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
            Total: {fmt(total)}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Invoice ---
function InvoicePreview({ d }: { d: Record<string, unknown> }) {
  const lines = (d.lines as Record<string, unknown>[]) || []
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.invoice_number as string}</span>
        <StatusBadge status={d.status as string} />
        {d.invoice_type === 'credit_note' ? <Badge label="Credit Note" color="#7c3aed" bg="#f5f3ff" /> : null}
      </div>
      <MetaRow label="Total" value={fmt(d.total as number)} />
      <MetaRow label="Due Date" value={fmtDate(d.due_date as string)} />
      {d.paid_at ? <MetaRow label="Paid" value={fmtDateTime(d.paid_at as string)} /> : null}
      <MetaRow label="Created" value={fmtDateTime(d.created_at as string)} />
      {lines.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Lines ({lines.length})</h5>
          <LineTable lines={lines} priceKey="unit_price" />
        </div>
      )}
    </div>
  )
}

// --- Job ---
function JobPreview({ d }: { d: Record<string, unknown> }) {
  const tasks = (d.tasks as Record<string, unknown>[]) || []
  const assignee = (d.engineer ?? d.assigned_to) as Record<string, unknown> | null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.job_number as string}</span>
        <StatusBadge status={d.status as string} />
      </div>
      {d.title ? <p className="text-sm text-slate-700 dark:text-slate-300">{d.title as string}</p> : null}
      {assignee ? <MetaRow label="Engineer" value={`${assignee.first_name} ${assignee.last_name}`} /> : null}
      {d.scheduled_date ? (
        <MetaRow
          label="Scheduled"
          value={`${fmtDate(d.scheduled_date as string)}${d.scheduled_time ? ` ${(d.scheduled_time as string).slice(0, 5)}` : ''}${d.estimated_duration_minutes ? ` (${d.estimated_duration_minutes}min)` : ''}`}
        />
      ) : null}
      {d.notes ? <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{d.notes as string}</p> : null}
      {tasks.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Tasks ({tasks.length})</h5>
          <div className="space-y-1">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span className={`h-2 w-2 rounded-full shrink-0 ${t.is_completed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="truncate">{t.description as string}</span>
                {t.response_value ? (
                  <span className="ml-auto text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{t.response_value as string}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Purchase Order ---
function PurchaseOrderPreview({ d }: { d: Record<string, unknown> }) {
  const lines = (d.lines as Record<string, unknown>[]) || []
  const supplier = d.suppliers as Record<string, unknown> | null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.po_number as string}</span>
        <StatusBadge status={d.status as string} />
      </div>
      {supplier ? <MetaRow label="Supplier" value={supplier.name as string} /> : null}
      {d.supplier_ref ? <MetaRow label="Supplier Ref" value={d.supplier_ref as string} /> : null}
      <MetaRow label="Created" value={fmtDateTime(d.created_at as string)} />
      {lines.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Lines ({lines.length})</h5>
          <LineTable lines={lines} priceKey="unit_cost" />
        </div>
      )}
    </div>
  )
}

// --- Contact ---
function ContactPreview({ d }: { d: Record<string, unknown> }) {
  const roles = [
    d.is_primary ? 'Primary' : null,
    d.is_billing ? 'Billing' : null,
    d.is_shipping ? 'Shipping' : null,
    d.is_portal_admin ? 'Admin' : null,
    d.is_portal_user ? 'Portal' : null,
    d.is_technical ? 'Technical' : null,
    d.is_overseer ? 'Overseer' : null,
  ].filter((r): r is string => r !== null)
  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {d.first_name as string} {d.last_name as string}
      </span>
      {d.job_title ? <MetaRow label="Job Title" value={d.job_title as string} /> : null}
      {d.email ? <MetaRow label="Email" value={d.email as string} /> : null}
      {d.phone ? <MetaRow label="Phone" value={d.phone as string} /> : null}
      {d.mobile ? <MetaRow label="Mobile" value={d.mobile as string} /> : null}
      {roles.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {roles.map(r => (
            <Badge key={r} label={r} color="#059669" bg="#ecfdf5" />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Opportunity ---
function OpportunityPreview({ d }: { d: Record<string, unknown> }) {
  const owner = d.owner as Record<string, unknown> | null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.title as string}</span>
        <StatusBadge status={d.stage as string} />
      </div>
      {d.estimated_value ? <MetaRow label="Value" value={fmt(d.estimated_value as number)} /> : null}
      {d.probability != null ? <MetaRow label="Probability" value={`${d.probability}%`} /> : null}
      {d.expected_close_date ? <MetaRow label="Expected Close" value={fmtDate(d.expected_close_date as string)} /> : null}
      {owner ? <MetaRow label="Owner" value={`${owner.first_name} ${owner.last_name}`} /> : null}
      {d.description ? <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-4">{d.description as string}</p> : null}
    </div>
  )
}

// --- Contract ---
function ContractPreview({ d }: { d: Record<string, unknown> }) {
  const contractType = d.contract_types as Record<string, unknown> | null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.contract_number as string}</span>
        <StatusBadge status={d.status as string} />
      </div>
      {contractType ? <MetaRow label="Type" value={contractType.name as string} /> : null}
      <MetaRow label="Start" value={fmtDate(d.start_date as string)} />
      <MetaRow label="End" value={fmtDate(d.end_date as string)} />
      {d.annual_value ? <MetaRow label="Annual" value={fmt(d.annual_value as number)} /> : null}
      {d.billing_frequency ? <MetaRow label="Billing" value={(d.billing_frequency as string).replace(/^./, (c: string) => c.toUpperCase())} /> : null}
      <MetaRow label="Auto Renew" value={d.auto_renew ? 'Yes' : 'No'} />
    </div>
  )
}

// --- Deal Reg ---
function DealRegPreview({ d }: { d: Record<string, unknown> }) {
  const supplier = d.suppliers as Record<string, unknown> | null
  const lines = (d.lines as Record<string, unknown>[]) || []
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{(d.reference as string) || (d.title as string)}</span>
        <StatusBadge status={d.status as string} />
      </div>
      {d.title && d.reference ? <p className="text-sm text-slate-700 dark:text-slate-300">{d.title as string}</p> : null}
      {supplier ? <MetaRow label="Supplier" value={supplier.name as string} /> : null}
      <MetaRow label="Registered" value={fmtDate(d.registered_date as string)} />
      <MetaRow label="Expires" value={fmtDate(d.expiry_date as string)} />
      {lines.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Products ({lines.length})</h5>
          <div className="space-y-1">
            {lines.map((l, i) => {
              const product = l.products as Record<string, unknown> | null
              return (
                <div key={i} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700 py-1">
                  <span className="truncate max-w-[250px]">{(product?.name as string) || '-'}</span>
                  <span className="shrink-0 ml-2">{fmt(l.registered_buy_price as number)}{l.max_quantity ? ` x${l.max_quantity}` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
