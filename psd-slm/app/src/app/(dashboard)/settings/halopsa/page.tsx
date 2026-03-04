import { PageHeader } from '@/components/ui/page-header'

export default function HaloPSASettingsPage() {
  return (
    <div>
      <PageHeader
        title="HaloPSA Integration"
        subtitle="Connect your service desk and PSA system"
      />
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Coming Soon</h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          HaloPSA integration will allow you to sync tickets, assets, and customer records
          between Engage and your helpdesk. Configuration options will appear here once the
          integration is ready.
        </p>
      </div>
    </div>
  )
}
