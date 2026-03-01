import { PageHeader } from '@/components/ui/page-header'

export default function OrdersPage() {
  return (
    <div>
      <PageHeader title="Sales Orders" subtitle="Coming soon" />
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Coming Soon</h3>
        <p className="text-sm text-slate-400">
          The Sales Orders module will be built next. It maps 1:1 from accepted quotes to purchase orders.
        </p>
      </div>
    </div>
  )
}
