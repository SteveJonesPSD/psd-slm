'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JobsList({ jobs, jobTypes, engineers }: { jobs: any[]; jobTypes: any[]; engineers: any[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [engineerFilter, setEngineerFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const filtered = useMemo(() => {
    let result = jobs

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(j =>
        j.title?.toLowerCase().includes(q) ||
        j.job_number?.toLowerCase().includes(q) ||
        j.company?.name?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter(j => j.status === statusFilter)
    if (typeFilter) result = result.filter(j => j.job_type_id === typeFilter)
    if (engineerFilter) result = result.filter(j => j.assigned_to === engineerFilter)
    if (priorityFilter) result = result.filter(j => j.priority === priorityFilter)

    return result
  }, [jobs, search, statusFilter, typeFilter, engineerFilter, priorityFilter])

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs..."
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {Object.entries(JOB_STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Types</option>
          {jobTypes.map((t: { id: string; name: string }) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={engineerFilter}
          onChange={e => setEngineerFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Engineers</option>
          {engineers.map((e: { id: string; first_name: string; last_name: string }) => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Priorities</option>
          {Object.entries(JOB_PRIORITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Job #</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Engineer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(job => {
              const statusCfg = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: '#6b7280', bg: '#f3f4f6' }
              const priorityCfg = JOB_PRIORITY_CONFIG[job.priority] || { label: job.priority, color: '#6b7280', bg: '#f3f4f6' }
              const jt = job.job_type
              const eng = job.engineer
              const durationH = Math.floor(job.estimated_duration_minutes / 60)
              const durationM = job.estimated_duration_minutes % 60

              return (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/scheduling/jobs/${job.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                      {job.job_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{job.title}</td>
                  <td className="px-4 py-3 text-slate-600">{job.company?.name}</td>
                  <td className="px-4 py-3">
                    {jt && <Badge label={jt.name} color={jt.color} bg={jt.background} />}
                  </td>
                  <td className="px-4 py-3">
                    <Badge {...priorityCfg} />
                  </td>
                  <td className="px-4 py-3">
                    {eng ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                          style={{ backgroundColor: eng.color || '#6366f1' }}
                        >
                          {eng.initials || (eng.first_name[0] + eng.last_name[0])}
                        </div>
                        <span className="text-slate-600">{eng.first_name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {job.scheduled_date
                      ? new Date(job.scheduled_date + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {job.scheduled_time ? job.scheduled_time.substring(0, 5) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {durationH > 0 ? `${durationH}h` : ''}{durationM > 0 ? `${durationM}m` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Badge {...statusCfg} />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
