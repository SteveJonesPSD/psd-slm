'use client'

interface PDFViewerProps {
  pdfUrl: string | null
  filename: string | null
}

export function PDFViewer({ pdfUrl, filename }: PDFViewerProps) {
  if (!pdfUrl) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-10 text-center">
        <div className="text-4xl mb-3">📄</div>
        <p className="text-sm text-slate-400">PDF not available</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 bg-slate-50">
        <span className="text-xs font-medium text-slate-500 truncate">
          {filename || 'Purchase Order PDF'}
        </span>
        <a
          href={pdfUrl}
          download={filename || 'purchase-order.pdf'}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Download
        </a>
      </div>
      <object
        data={pdfUrl}
        type="application/pdf"
        className="w-full"
        style={{ height: '70vh', minHeight: 500 }}
      >
        <div className="p-10 text-center">
          <p className="text-sm text-slate-400 mb-3">
            Your browser cannot display PDFs inline.
          </p>
          <a
            href={pdfUrl}
            download
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Download PDF
          </a>
        </div>
      </object>
    </div>
  )
}
