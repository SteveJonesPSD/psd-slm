import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

interface EngineerDashboardProps {
  user: {
    id: string
    orgId: string
    firstName: string
  }
}

export async function EngineerDashboard({ user }: EngineerDashboardProps) {
  const supabase = await createClient()

  const now = new Date()
  const today = formatDate(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = formatDate(tomorrow)

  // Fetch jobs for today + tomorrow, collections pending for this engineer, assigned tickets
  const [jobsResult, collectionsResult, ticketsResult] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        id, job_number, title, status, priority, scheduled_date, scheduled_time, estimated_duration,
        company:company_id(id, name),
        job_type:job_type_id(id, name, slug, color, background)
      `)
      .eq('org_id', user.orgId)
      .eq('assigned_to', user.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', tomorrowStr)
      .neq('status', 'cancelled')
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('job_collections')
      .select(`
        id, status, created_at,
        jobs!inner(id, job_number, title, assigned_to),
        sales_orders(id, so_number, customers(id, name))
      `)
      .eq('org_id', user.orgId)
      .eq('status', 'pending'),
    supabase
      .from('tickets')
      .select(`
        id, ticket_number, subject, status, priority, created_at, updated_at,
        customer:customer_id(id, name)
      `)
      .eq('org_id', user.orgId)
      .eq('assigned_to', user.id)
      .not('status', 'in', '("closed","resolved","cancelled","merged")')
      .order('updated_at', { ascending: false })
      .limit(20),
  ])

  // Supabase returns FK joins as arrays — unwrap to single objects
  const jobs = (jobsResult.data || []).map((j: Record<string, unknown>) => ({
    ...j,
    company: Array.isArray(j.company) ? j.company[0] || null : j.company,
    job_type: Array.isArray(j.job_type) ? j.job_type[0] || null : j.job_type,
  })) as Array<{
    id: string; job_number: string; title: string; status: string; priority: string
    scheduled_date: string; scheduled_time: string | null; estimated_duration: number | null
    company: { id: string; name: string } | null
    job_type: { id: string; name: string; slug: string; color: string; background: string } | null
  }>

  const allCollections = (collectionsResult.data || []).map((c: Record<string, unknown>) => ({
    ...c,
    jobs: Array.isArray(c.jobs) ? c.jobs[0] || null : c.jobs,
    sales_orders: Array.isArray(c.sales_orders) ? c.sales_orders[0] || null : c.sales_orders,
  })) as Array<{
    id: string; status: string; created_at: string
    jobs: { id: string; job_number: string; title: string; assigned_to: string | null } | null
    sales_orders: { id: string; so_number: string; customers: unknown } | null
  }>
  const collections = allCollections.filter(c => c.jobs?.assigned_to === user.id)

  type Ticket = {
    id: string; ticket_number: string; subject: string; status: string; priority: string
    created_at: string; updated_at: string
    customer: { id: string; name: string } | null
  }
  const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  const tickets = ((ticketsResult.data || []).map((t: Record<string, unknown>) => ({
    ...t,
    customer: Array.isArray(t.customer) ? t.customer[0] || null : t.customer,
  })) as Ticket[]).sort(
    (a, b) => (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9)
  )

  const todayJobs = jobs.filter(j => j.scheduled_date === today)
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrowStr)

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Today's Jobs"
          value={todayJobs.length}
          sub={todayJobs.filter(j => j.status === 'completed').length > 0
            ? `${todayJobs.filter(j => j.status === 'completed').length} completed`
            : 'Scheduled'}
          accent="#2563eb"
        />
        <StatCard
          label="Tomorrow's Jobs"
          value={tomorrowJobs.length}
          accent="#6366f1"
        />
        <StatCard
          label="Pending Collections"
          value={collections.length}
          accent="#d97706"
        />
        <StatCard
          label="Open Tickets"
          value={tickets.length}
          sub={tickets.filter(t => t.priority === 'urgent' || t.priority === 'high').length > 0
            ? `${tickets.filter(t => t.priority === 'urgent' || t.priority === 'high').length} high/urgent`
            : undefined}
          accent="#dc2626"
        />
      </div>

      {/* Collections banner */}
      {collections.length > 0 && (
        <Link href="/collections?status=pending" className="no-underline block mb-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/30 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {collections.length} Collection{collections.length !== 1 ? 's' : ''} Pending Pickup
              </div>
              <div className="text-xs text-amber-500 dark:text-amber-400">
                Stock ready for collection
              </div>
            </div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">View &rarr;</span>
          </div>
        </Link>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs — Today */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              Today &mdash; {formatDisplayDate(now)}
            </h3>
            <Link href="/scheduling" className="text-xs font-medium text-blue-600 dark:text-blue-400 no-underline hover:underline">
              View Schedule &rarr;
            </Link>
          </div>
          {todayJobs.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No jobs scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayJobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Jobs — Tomorrow */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              Tomorrow &mdash; {formatDisplayDate(tomorrow)}
            </h3>
          </div>
          {tomorrowJobs.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No jobs scheduled for tomorrow.</p>
          ) : (
            <div className="space-y-3">
              {tomorrowJobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Assigned Tickets */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              My Tickets
            </h3>
            <Link href="/helpdesk" className="text-xs font-medium text-blue-600 dark:text-blue-400 no-underline hover:underline">
              View All &rarr;
            </Link>
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No open tickets assigned to you.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {tickets.map(ticket => (
                <Link
                  key={ticket.id}
                  href={`/helpdesk/tickets/${ticket.id}`}
                  className="flex items-center justify-between py-3 no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">
                        {ticket.ticket_number}
                      </span>
                      <Badge
                        label={TICKET_PRIORITY_CONFIG[ticket.priority]?.label || ticket.priority}
                        color={TICKET_PRIORITY_CONFIG[ticket.priority]?.color || '#6b7280'}
                        bg={TICKET_PRIORITY_CONFIG[ticket.priority]?.bg || '#f3f4f6'}
                      />
                    </div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {ticket.customer?.name || 'Unknown customer'}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0">
                    <Badge
                      label={TICKET_STATUS_CONFIG[ticket.status]?.label || ticket.status}
                      color={TICKET_STATUS_CONFIG[ticket.status]?.color || '#6b7280'}
                      bg={TICKET_STATUS_CONFIG[ticket.status]?.bg || '#f3f4f6'}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function JobCard({ job }: { job: {
  id: string; job_number: string; title: string; status: string; priority: string
  scheduled_time: string | null; estimated_duration: number | null
  company: { id: string; name: string } | null
  job_type: { id: string; name: string; slug: string; color: string; background: string } | null
} }) {
  const statusCfg = JOB_STATUS_CONFIG[job.status]
  const priorityCfg = JOB_PRIORITY_CONFIG[job.priority]

  return (
    <Link
      href={`/scheduling/jobs/${job.id}`}
      className="block rounded-lg border border-slate-100 dark:border-slate-700 p-3.5 no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              {job.job_number}
            </span>
            {job.job_type && (
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ color: job.job_type.color, backgroundColor: job.job_type.background }}
              >
                {job.job_type.name}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
            {job.title}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {job.company?.name || 'No customer'}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {statusCfg && (
            <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
          )}
          {priorityCfg && job.priority !== 'normal' && (
            <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />
          )}
        </div>
      </div>
      {job.scheduled_time && (
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{formatTime(job.scheduled_time)}</span>
          {job.estimated_duration && (
            <span>{job.estimated_duration >= 60
              ? `${Math.floor(job.estimated_duration / 60)}h${job.estimated_duration % 60 > 0 ? ` ${job.estimated_duration % 60}m` : ''}`
              : `${job.estimated_duration}m`
            }</span>
          )}
        </div>
      )}
    </Link>
  )
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(time: string): string {
  const [h, m] = time.split(':')
  return `${h}:${m}`
}
