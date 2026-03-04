'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { uploadAttachment } from '../../actions'

interface Attachment {
  id: string
  message_id: string | null
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ImagePreviewPopout({ src, alt, anchorEl }: { src: string; alt: string; anchorEl: HTMLElement }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect()
    // Position above the thumbnail, aligned to its left edge
    setPos({
      top: rect.top - 8, // small gap above thumbnail
      left: rect.left,
    })
  }, [anchorEl])

  if (!pos) return null

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-64 max-w-64 rounded object-contain"
        />
        <div className="mt-1 text-[10px] text-slate-400 text-center truncate max-w-64 px-1">
          {alt}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function MediaSection({ ticketId, attachments }: { ticketId: string; attachments: Record<string, unknown>[] }) {
  const router = useRouter()
  const items = attachments as unknown as Attachment[]
  const [expanded, setExpanded] = useState(items.length > 0)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredAnchor, setHoveredAnchor] = useState<HTMLElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  function downloadUrl(attachmentId: string) {
    return `/api/helpdesk/tickets/${ticketId}/attachments/${attachmentId}`
  }

  function addFiles(files: File[]) {
    setSelectedFiles(prev => [...prev, ...files])
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) addFiles(files)
  }, [])

  function handleThumbEnter(id: string, el: HTMLElement) {
    setHoveredId(id)
    setHoveredAnchor(el)
  }

  function handleThumbLeave() {
    setHoveredId(null)
    setHoveredAnchor(null)
  }

  async function handleUpload() {
    if (!selectedFiles.length) return
    setUploading(true)
    setError(null)

    const formData = new FormData()
    for (const file of selectedFiles) {
      formData.append('files', file)
    }

    try {
      const result = await uploadAttachment(ticketId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSelectedFiles([])
        setShowUpload(false)
        router.refresh()
      }
    } finally {
      setUploading(false)
    }
  }

  const hoveredAtt = hoveredId ? items.find(a => a.id === hoveredId) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
        >
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Media
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {items.length}
          </span>
        </button>
        <button
          onClick={() => { setShowUpload(!showUpload); if (!expanded) setExpanded(true) }}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          + Upload
        </button>
      </div>

      {expanded && (
        <div className="mt-2">
          {showUpload && (
            <div className="mb-3 space-y-2">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
                  dragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <svg className="mb-1 h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-xs text-slate-400">
                  {dragging ? 'Drop files here' : 'Drop files or click to browse'}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-300">Images, PDF, Word &middot; Max 20MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={handleFilesSelected}
                  className="hidden"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-slate-600 border border-gray-200">
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-slate-400 hover:text-red-500 ml-0.5"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              {selectedFiles.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {items.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {items.map(att => (
                <a
                  key={att.id}
                  href={downloadUrl(att.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50 no-underline group"
                >
                  {isImage(att.mime_type) ? (
                    <div
                      className="shrink-0"
                      onMouseEnter={(e) => handleThumbEnter(att.id, e.currentTarget)}
                      onMouseLeave={handleThumbLeave}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={downloadUrl(att.id)}
                        alt={att.file_name}
                        className="h-8 w-8 rounded object-cover border border-gray-200"
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 border border-gray-200 shrink-0">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600">
                      {att.file_name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatDate(att.created_at)} &middot; {formatFileSize(att.file_size)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300">No media yet</p>
          )}
        </div>
      )}

      {/* Hover preview popout — rendered via portal to escape overflow clipping */}
      {hoveredAtt && hoveredAnchor && isImage(hoveredAtt.mime_type) && (
        <ImagePreviewPopout
          src={downloadUrl(hoveredAtt.id)}
          alt={hoveredAtt.file_name}
          anchorEl={hoveredAnchor}
        />
      )}
    </div>
  )
}
