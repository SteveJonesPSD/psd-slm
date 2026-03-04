import { PageHeader } from '@/components/ui/page-header'
import { SeedDataButton } from './seed-data-button'
import { SeedHelpdeskButton } from './seed-helpdesk-button'
import { SeedOrdersButton } from './seed-orders-button'
import { SeedSchedulingButton } from './seed-scheduling-button'
import { SeedPoButton } from './seed-po-button'
import { SeedStockButton } from './seed-stock-button'
import { SeedInvoicesButton } from './seed-invoices-button'
import { SeedContractsButton } from './seed-contracts-button'
import { SeedCollectionsButton } from './seed-collections-button'

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

        {/* Seed helpdesk data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Service Desk Data</h3>
              <p className="mt-1 text-sm text-slate-500">
                Populate service desk categories, tags, SLA plans, contracts, canned responses,
                sample tickets, and KB articles. Idempotent — safe to run multiple times.
              </p>
            </div>
            <SeedHelpdeskButton />
          </div>
        </div>

        {/* Seed sales orders data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Sales Orders</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create a sample sales order from the first accepted quote with mixed line
                statuses. Requires quotes to be seeded first. Idempotent.
              </p>
            </div>
            <SeedOrdersButton />
          </div>
        </div>

        {/* Seed purchase orders data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Purchase Orders</h3>
              <p className="mt-1 text-sm text-slate-500">
                Generate purchase orders from existing sales order lines. Groups lines by
                supplier and delivery destination. Requires sales orders to be seeded first. Idempotent.
              </p>
            </div>
            <SeedPoButton />
          </div>
        </div>

        {/* Seed stock data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Stock Data</h3>
              <p className="mt-1 text-sm text-slate-500">
                Populate default stock location, stock levels for stocked products, initial movements,
                and serial numbers. Requires products to be seeded first. Idempotent.
              </p>
            </div>
            <SeedStockButton />
          </div>
        </div>

        {/* Seed scheduling data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Scheduling Data</h3>
              <p className="mt-1 text-sm text-slate-500">
                Populate job types and sample jobs with notes for testing the dispatch calendar
                and field engineer views. Requires company data to be seeded first.
              </p>
            </div>
            <SeedSchedulingButton />
          </div>
        </div>

        {/* Seed invoices data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Invoices</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create a sample invoice from the first sales order. Requires sales orders to be
                seeded first. Idempotent — safe to run multiple times.
              </p>
            </div>
            <SeedInvoicesButton />
          </div>
        </div>

        {/* Seed contract types */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Contract Types</h3>
              <p className="mt-1 text-sm text-slate-500">
                Populate ProFlex 1-4 contract types for ICT support tiers.
                Idempotent — safe to run multiple times.
              </p>
            </div>
            <SeedContractsButton />
          </div>
        </div>

        {/* Seed collections data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Seed Collections</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create 3 sample collection slips (pending, collected, partial) for testing
                the engineer stock collection flow. Requires scheduling and product data first.
                The pending slip includes a test magic link.
              </p>
            </div>
            <SeedCollectionsButton />
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
