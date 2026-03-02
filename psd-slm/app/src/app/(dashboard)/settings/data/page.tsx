import { PageHeader } from '@/components/ui/page-header'
import { SeedDataButton } from './seed-data-button'

export default function DataSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Data Management"
        subtitle="Seed data, import, and export tools"
      />

      <div className="space-y-4">
        {/* Seed data card - functional */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Default Data</h3>
              <p className="mt-1 text-sm text-slate-500">
                Populate default organisation settings and brand records. This is idempotent
                and will not overwrite existing data.
              </p>
            </div>
            <SeedDataButton />
          </div>
        </div>

        {/* Import/Export placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Import & Export</h3>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Coming soon — tools for bulk data import (CSV/Excel), data export, and backup
            functionality for customers, products, and other records.
          </p>
        </div>
      </div>
    </div>
  )
}
