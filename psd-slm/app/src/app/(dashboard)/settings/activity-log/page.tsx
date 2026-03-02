import { PageHeader } from '@/components/ui/page-header'

export default function ActivityLogSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Browse and search system activity"
      />
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Coming Soon</h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          A searchable and filterable view of all system activity — user logins, record changes,
          quote events, and more. All activity is already being logged and will be browsable here
          in a future update.
        </p>
      </div>
    </div>
  )
}
