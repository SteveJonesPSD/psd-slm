import { getCollectionByToken } from '@/lib/collections/actions'
import { CollectionConfirm } from './collection-confirm'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function CollectPage({ params }: PageProps) {
  const { token } = await params
  const collection = await getCollectionByToken(token)

  if (!collection) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Collection Not Found</h2>
        <p className="text-sm text-slate-500">This collection slip link is invalid or has expired.</p>
      </div>
    )
  }

  if (collection.status === 'cancelled') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Collection Cancelled</h2>
        <p className="text-sm text-slate-500">
          This collection slip ({collection.slip_number}) has been cancelled.
        </p>
      </div>
    )
  }

  if (collection.status === 'collected' || collection.status === 'partial') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">{collection.status === 'collected' ? '✅' : '⚠️'}</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {collection.status === 'collected' ? 'Collection Confirmed' : 'Partial Collection'}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {collection.slip_number} — {collection.customer_name}
        </p>
        {collection.collected_at && (
          <p className="text-xs text-slate-400">
            Confirmed {new Date(collection.collected_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {collection.collected_by_name && ` by ${collection.collected_by_name}`}
          </p>
        )}

        {/* Show confirmed items summary */}
        <div className="mt-8 max-w-lg mx-auto text-left">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Items</h3>
          {collection.lines
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((line) => (
              <div
                key={line.id}
                className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${
                  line.is_confirmed ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  line.is_confirmed ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'
                }`}>
                  {line.is_confirmed ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {line.quantity_expected}× {line.description}
                  </div>
                  {!line.is_confirmed && (
                    <div className="text-xs text-amber-600">Not collected</div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    )
  }

  // Status is pending — show confirmation UI
  return <CollectionConfirm collection={collection} token={token} />
}
