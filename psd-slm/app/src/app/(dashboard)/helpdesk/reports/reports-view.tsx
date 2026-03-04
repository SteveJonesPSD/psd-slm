'use client'

import { useState, useEffect } from 'react'
import { getReportData } from '../actions'

function formatDuration(ms: number) {
  if (ms <= 0) return '—'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    return `${days}d ${remainHours}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

type DatePreset = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom'

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().substring(0, 10)

  switch (preset) {
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { start: start.toISOString().substring(0, 10), end }
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { start: start.toISOString().substring(0, 10), end }
    }
    case '90d': {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      return { start: start.toISOString().substring(0, 10), end }
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: start.toISOString().substring(0, 10), end }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: start.toISOString().substring(0, 10), end: endOfMonth.toISOString().substring(0, 10) }
    }
    default:
      return { start: end, end }
  }
}

interface ReportData {
  volume: {
    created: number
    resolved: number
    currentlyOpen: number
    uniqueContacts: number
    returningContacts: number
    newContacts: number
  }
  slaByPriority: Record<string, {
    count: number
    responseTotal: number
    resolutionTotal: number
    responseMet: number
    resolutionMet: number
  }>
  agents: {
    id: string
    name: string
    assigned: number
    resolved: number
    responseTotal: number
    responseCount: number
    resolutionTotal: number
    resolutionCount: number
    slaMet: number
    slaTotal: number
    timeLogged: number
  }[]
  categories: { name: string; count: number; resolutionTotal: number; resolvedCount: number }[]
  customers: { name: string; count: number; openCount: number; slaMet: number; slaTotal: number }[]
}

export function ReportsView({ customers, brands }: {
  customers: { id: string; name: string }[]
  brands: { id: string; name: string }[]
}) {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [brandId, setBrandId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset)
      setStartDate(start)
      setEndDate(end)
    }
  }, [preset])

  useEffect(() => {
    if (!startDate || !endDate) return
    let cancelled = false
    setLoading(true)
    getReportData({ startDate, endDate, brandId: brandId || undefined, customerId: customerId || undefined })
      .then(result => {
        if (!cancelled) {
          setData(result as ReportData)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [startDate, endDate, brandId, customerId])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500">Helpdesk analytics and performance metrics</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Period</label>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value as DatePreset)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Brand</label>
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Brands</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
          <select
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">Loading report data...</div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Section 1: Volume Summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Volume Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{data.volume.created}</div>
                <div className="text-xs text-slate-500">Tickets Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.volume.resolved}</div>
                <div className="text-xs text-slate-500">Tickets Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{data.volume.currentlyOpen}</div>
                <div className="text-xs text-slate-500">Currently Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{data.volume.uniqueContacts}</div>
                <div className="text-xs text-slate-500">Unique Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{data.volume.newContacts}</div>
                <div className="text-xs text-slate-500">First-Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{data.volume.returningContacts}</div>
                <div className="text-xs text-slate-500">Returning</div>
              </div>
            </div>
          </div>

          {/* Section 2: SLA Performance by Priority */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">SLA Performance by Priority</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left font-medium text-slate-500">Priority</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Tickets</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Avg Response</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Avg Resolution</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Response SLA %</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Resolution SLA %</th>
                  </tr>
                </thead>
                <tbody>
                  {['urgent', 'high', 'medium', 'low'].map(p => {
                    const s = data.slaByPriority[p]
                    if (!s) return null
                    const avgResp = s.count > 0 ? s.responseTotal / s.count : 0
                    const avgRes = s.count > 0 ? s.resolutionTotal / s.count : 0
                    const respPct = s.count > 0 ? Math.round((s.responseMet / s.count) * 100) : 0
                    const resPct = s.count > 0 ? Math.round((s.resolutionMet / s.count) * 100) : 0
                    return (
                      <tr key={p} className="border-b border-gray-50">
                        <td className="py-2 capitalize font-medium text-slate-900">{p}</td>
                        <td className="py-2 text-right text-slate-600">{s.count}</td>
                        <td className="py-2 text-right text-slate-600">{formatDuration(avgResp)}</td>
                        <td className="py-2 text-right text-slate-600">{formatDuration(avgRes)}</td>
                        <td className="py-2 text-right">
                          <span className={respPct >= 90 ? 'text-green-600' : respPct >= 75 ? 'text-amber-600' : 'text-red-600'}>
                            {respPct}%
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span className={resPct >= 90 ? 'text-green-600' : resPct >= 75 ? 'text-amber-600' : 'text-red-600'}>
                            {resPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Agent Performance */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Agent Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left font-medium text-slate-500">Agent</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Assigned</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Resolved</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Avg Response</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Avg Resolution</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Time Logged</th>
                    <th className="pb-2 text-right font-medium text-slate-500">SLA %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map(agent => {
                    const avgResp = agent.responseCount > 0 ? agent.responseTotal / agent.responseCount : 0
                    const avgRes = agent.resolutionCount > 0 ? agent.resolutionTotal / agent.resolutionCount : 0
                    const slaPct = agent.slaTotal > 0 ? Math.round((agent.slaMet / agent.slaTotal) * 100) : 0
                    const timeHours = Math.floor(agent.timeLogged / 60)
                    const timeMin = agent.timeLogged % 60
                    return (
                      <tr key={agent.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium text-slate-900">{agent.name}</td>
                        <td className="py-2 text-right text-slate-600">{agent.assigned}</td>
                        <td className="py-2 text-right text-slate-600">{agent.resolved}</td>
                        <td className="py-2 text-right text-slate-600">{formatDuration(avgResp)}</td>
                        <td className="py-2 text-right text-slate-600">{formatDuration(avgRes)}</td>
                        <td className="py-2 text-right text-slate-600">{timeHours > 0 ? `${timeHours}h ` : ''}{timeMin}m</td>
                        <td className="py-2 text-right">
                          <span className={slaPct >= 90 ? 'text-green-600' : slaPct >= 75 ? 'text-amber-600' : 'text-red-600'}>
                            {slaPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {data.agents.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-center text-slate-400">No agent data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Category Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Category Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-slate-500">Category</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Tickets</th>
                  <th className="pb-2 text-right font-medium text-slate-500">% of Total</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Avg Resolution</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat, i) => {
                  const pct = data.volume.created > 0 ? Math.round((cat.count / data.volume.created) * 100) : 0
                  const avgRes = cat.resolvedCount > 0 ? cat.resolutionTotal / cat.resolvedCount : 0
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-slate-900">{cat.name}</td>
                      <td className="py-2 text-right text-slate-600">{cat.count}</td>
                      <td className="py-2 text-right text-slate-600">{pct}%</td>
                      <td className="py-2 text-right text-slate-600">{formatDuration(avgRes)}</td>
                    </tr>
                  )
                })}
                {data.categories.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No category data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section 5: Customer Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Customer Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-slate-500">Company</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Tickets</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Open</th>
                  <th className="pb-2 text-right font-medium text-slate-500">SLA Compliance</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((cust, i) => {
                  const slaPct = cust.slaTotal > 0 ? Math.round((cust.slaMet / cust.slaTotal) * 100) : 0
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-slate-900">{cust.name}</td>
                      <td className="py-2 text-right text-slate-600">{cust.count}</td>
                      <td className="py-2 text-right text-slate-600">{cust.openCount}</td>
                      <td className="py-2 text-right">
                        <span className={slaPct >= 90 ? 'text-green-600' : slaPct >= 75 ? 'text-amber-600' : 'text-red-600'}>
                          {slaPct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {data.customers.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No customer data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
