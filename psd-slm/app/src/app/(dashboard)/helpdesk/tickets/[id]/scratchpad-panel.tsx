'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addScratchpadNote, updateScratchpadNote, deleteScratchpadNote } from '../../actions'

interface ScratchpadNote {
  id: string
  ticket_id: string
  created_by: string
  source: 'manual' | 'helen_assist'
  assist_log_id: string | null
  title: string | null
  body: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  creator: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function SourceBadge({ source }: { source: 'manual' | 'helen_assist' }) {
  if (source === 'helen_assist') {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
        Helen AI
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
      Manual
    </span>
  )
}

function NoteCard({
  note,
  currentUserId,
  onUpdate,
}: {
  note: ScratchpadNote
  currentUserId: string
  onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(note.body)
  const [editTitle, setEditTitle] = useState(note.title || '')
  const [showFull, setShowFull] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isCreator = note.created_by === currentUserId
  const isLong = note.body.length > 200

  async function handlePin() {
    setSaving(true)
    await updateScratchpadNote(note.id, { is_pinned: !note.is_pinned })
    onUpdate()
    setSaving(false)
  }

  async function handleSaveEdit() {
    setSaving(true)
    await updateScratchpadNote(note.id, {
      title: editTitle || undefined,
      body: editBody,
    })
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await deleteScratchpadNote(note.id)
    onUpdate()
    setDeleting(false)
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-300"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={4}
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setEditing(false); setEditBody(note.body); setEditTitle(note.title || '') }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving || !editBody.trim()}
            className="rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${note.is_pinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {note.title && (
            <div className="text-xs font-semibold text-slate-700 mb-0.5">{note.title}</div>
          )}
          <div className="text-xs text-slate-600 whitespace-pre-wrap">
            {isLong && !showFull ? (
              <>
                {note.body.slice(0, 200)}...
                <button onClick={() => setShowFull(true)} className="ml-1 text-teal-600 hover:text-teal-700">
                  more
                </button>
              </>
            ) : (
              <>
                {note.body}
                {isLong && (
                  <button onClick={() => setShowFull(false)} className="ml-1 text-teal-600 hover:text-teal-700">
                    less
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {note.is_pinned && (
            <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SourceBadge source={note.source} />
          <span className="text-[10px] text-slate-400">
            {note.creator ? `${note.creator.first_name} ${note.creator.last_name}` : 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-300">{formatDate(note.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePin}
            disabled={saving}
            title={note.is_pinned ? 'Unpin' : 'Pin to top'}
            className="text-slate-300 hover:text-amber-500 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill={note.is_pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(true)}
            title="Expand"
            className="text-slate-300 hover:text-slate-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
          <button
            onClick={() => setEditing(true)}
            title="Edit"
            className="text-slate-300 hover:text-slate-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          {isCreator && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[10px] text-red-600 hover:text-red-800 font-medium"
                >
                  {deleting ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="text-slate-300 hover:text-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setExpanded(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {note.title ? (
                  <h3 className="text-sm font-semibold text-slate-800">{note.title}</h3>
                ) : (
                  <h3 className="text-sm font-semibold text-slate-400">Scratchpad Note</h3>
                )}
                <SourceBadge source={note.source} />
              </div>
              <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.body}</div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 border-t border-gray-100 pt-3">
              <span>{note.creator ? `${note.creator.first_name} ${note.creator.last_name}` : 'Unknown'}</span>
              <span>&middot;</span>
              <span>{formatDate(note.created_at)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ScratchpadPanel({
  ticketId,
  notes: initialNotes,
  currentUserId,
}: {
  ticketId: string
  notes: Record<string, unknown>[]
  currentUserId: string
}) {
  const router = useRouter()
  const notes = initialNotes as unknown as ScratchpadNote[]
  const [expanded, setExpanded] = useState(notes.length > 0)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [listHeight, setListHeight] = useState(320)
  const resizingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(320)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = listHeight

    const handleMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const delta = ev.clientY - startYRef.current
      const newH = Math.max(120, Math.min(600, startHeightRef.current + delta))
      setListHeight(newH)
    }
    const handleUp = () => {
      resizingRef.current = false
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [listHeight])

  function handleRefresh() {
    router.refresh()
  }

  async function handleAddNote() {
    if (!newBody.trim()) return
    setSaving(true)
    await addScratchpadNote(ticketId, {
      title: newTitle || undefined,
      body: newBody,
      source: 'manual',
    })
    setNewTitle('')
    setNewBody('')
    setShowAdd(false)
    setSaving(false)
    router.refresh()
  }

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
          Scratchpad
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {notes.length}
          </span>
        </button>
        <button
          onClick={() => { setShowAdd(!showAdd); if (!expanded) setExpanded(true) }}
          className="text-xs text-teal-600 hover:text-teal-800"
        >
          + Add Note
        </button>
      </div>

      {expanded && (
        <div className="mt-2">
          {showAdd && (
            <div className="mb-3 space-y-2 rounded-lg border border-teal-200 bg-teal-50/30 p-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-300"
              />
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                placeholder="Write a private note..."
                className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-300 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAdd(false); setNewTitle(''); setNewBody('') }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={saving || !newBody.trim()}
                  className="rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {notes.length > 0 ? (
            <>
              <div
                className="space-y-2 overflow-y-auto"
                style={{ maxHeight: `${listHeight}px` }}
              >
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    currentUserId={currentUserId}
                    onUpdate={handleRefresh}
                  />
                ))}
              </div>
              {/* Resize handle */}
              <div
                onMouseDown={handleResizeStart}
                className="flex justify-center pt-1.5 pb-0.5 cursor-ns-resize group"
                title="Drag to resize"
              >
                <div className="h-1 w-10 rounded-full bg-slate-200 group-hover:bg-slate-400 transition-colors" />
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-300">
              No notes yet. Use &lsquo;Help me Fix This&rsquo; for AI suggestions, or add your own.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
