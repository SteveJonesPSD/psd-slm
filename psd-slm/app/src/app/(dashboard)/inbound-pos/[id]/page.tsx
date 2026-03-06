import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getInboundPO } from '../actions'
import { InboundPODetail } from './inbound-po-detail'

export default async function InboundPODetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getInboundPO(id)

  if ('error' in result || !result.data) {
    notFound()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/inbound-pos"
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          &larr; Back to Customer POs
        </Link>
      </div>
      <InboundPODetail data={result.data as any} />
    </div>
  )
}
