'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { uploadAttachment, deleteAttachment, getAttachmentUrl } from '../attachment-actions'

interface Attachment {
  id: string
  file_name: string
  file_size: number
  content_type: string
  uploaded_by: string
  uploader_name: string
  created_at: string
}

interface Props {
  dealRegId: string
  attachments: Attachment[]
  canUpload: boolean
  canDelete: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(contentType: string): string {
  if (contentType === 'application/pdf') return '📄'
  if (contentType.startsWith('image/')) return '🖼️'
  return '📧'
}

export function AttachmentsSection({ dealRegId, attachments, canUpload, canDelete }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const fd = new FormData()
    fd.set('file', file)

    const result = await uploadAttachment(dealRegId, fd)

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  const handleDownload = async (attachmentId: string) => {
    const result = await getAttachmentUrl(attachmentId)
    if (result.error) {
      setError(result.error)
    } else if (result.url) {
      window.open(result.url, '_blank')
    }
  }

  const handleDelete = async (attachmentId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return

    setDeleting(attachmentId)
    const result = await deleteAttachment(attachmentId)
    setDeleting('')

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Supplier Confirmation</h3>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">No confirmation files uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide">File</th>
                <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Size</th>
                <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Uploaded</th>
                <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide">By</th>
                <th className="pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-8"></th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-2.5 pr-3">
                    <button
                      onClick={() => handleDownload(a.id)}
                      className="flex items-center gap-1.5 text-blue-600 hover:underline text-left"
                    >
                      <span>{fileIcon(a.content_type)}</span>
                      <span>{a.file_name}</span>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-slate-500 whitespace-nowrap">
                    {formatFileSize(a.file_size)}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                    {formatDate(a.created_at)}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500">
                    {a.uploader_name}
                  </td>
                  <td className="py-2.5">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(a.id, a.file_name)}
                        disabled={deleting === a.id}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Delete file"
                      >
                        {deleting === a.id ? (
                          <span className="text-xs text-slate-400">...</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
