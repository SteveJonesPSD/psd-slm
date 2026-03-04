import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { getInvoice, getSalesOrderForInvoice } from '../../actions'
import { InvoiceEditForm } from './invoice-edit-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceEditPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('invoices', 'edit')

  const invoice = await getInvoice(id)
  if (!invoice) notFound()
  if (invoice.status !== 'draft') redirect(`/invoices/${id}`)

  const soData = await getSalesOrderForInvoice(invoice.sales_order_id)
  if (!soData) notFound()

  return (
    <div>
      <Link
        href={`/invoices/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Back to {invoice.invoice_number}
      </Link>

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Edit {invoice.invoice_number}</h2>

      <InvoiceEditForm
        invoiceId={id}
        invoice={invoice}
        soData={soData}
      />
    </div>
  )
}
