'use client'

import { useState } from 'react'
import { getChatArchive, getChatArchiveDetail, type ArchivedChat, type ArchivedChatDetail } from '@/lib/chat-sessions'
import { renderMarkdown } from '@/lib/chat-markdown'

const AGENT_CONFIG: Record<string, { name: string; color: string }> = {
  helen: { name: 'Helen', color: '#8b5cf6' },
  jasper: { name: 'Jasper', color: '#3b82f6' },
  lucia: { name: 'Lucia', color: '#10b981' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatArchiveList({ initialSessions }: { initialSessions: ArchivedChat[] }) {
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedSession, setSelectedSession] = useState<ArchivedChatDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [agentFilter, setAgentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = sessions.filter((s) => {
    if (agentFilter && s.agentId !== agentFilter) return false
    if (statusFilter === 'active' && s.isArchived) return false
    if (statusFilter === 'archived' && !s.isArchived) return false
    if (search) {
      const q = search.toLowerCase()
      const nameMatch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      const msgMatch = s.firstMessage?.toLowerCase().includes(q)
      if (!nameMatch && !msgMatch) return false
    }
    return true
  })

  const handleRefresh = async () => {
    const updated = await getChatArchive()
    setSessions(updated)
  }

  const handleViewThread = async (sessionId: string) => {
    setLoadingDetail(true)
    try {
      const detail = await getChatArchiveDetail(sessionId)
      setSelectedSession(detail)
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false)
    }
  }

  // Stat counts
  const totalSessions = sessions.length
  const activeSessions = sessions.filter((s) => !s.isArchived).length
  const archivedSessions = sessions.filter((s) => s.isArchived).length
  const totalMessages = sessions.reduce((acc, s) => acc + s.messageCount, 0)

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Chat Archive</h2>
          <p className="mt-1 text-sm text-slate-400">View all AI agent conversations across the team</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-slate-900">{totalSessions}</p>
          <p className="text-xs text-slate-500">Total Sessions</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-emerald-600">{activeSessions}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-slate-600">{archivedSessions}</p>
          <p className="text-xs text-slate-500">Archived</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-indigo-600">{totalMessages}</p>
          <p className="text-xs text-slate-500">Total Messages</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by user or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Agents</option>
          <option value="helen">Helen</option>
          <option value="jasper">Jasper</option>
          <option value="lucia">Lucia</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">Active &amp; Archived</option>
          <option value="active">Active only</option>
          <option value="archived">Archived only</option>
        </select>
      </div>

      {/* Sessions table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500">User</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500">Agent</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500">First Message</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Messages</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Last Activity</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No chat sessions found.
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const agent = AGENT_CONFIG[s.agentId] || { name: s.agentId, color: '#6b7280' }
              return (
                <tr key={s.sessionId} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: s.color || '#6366f1' }}
                      >
                        {s.initials || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.firstName} {s.lastName}</p>
                        <p className="text-[11px] text-slate-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
                    >
                      {agent.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-600 max-w-xs truncate">
                      {s.firstMessage || <span className="text-slate-300 italic">Empty session</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{s.messageCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.isArchived ? (
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">Archived</span>
                    ) : (
                      <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(s.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewThread(s.sessionId)}
                      className="rounded-lg px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Thread detail modal */}
      {(selectedSession || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedSession(null)}>
          <div
            className="mx-4 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading thread...</div>
            ) : selectedSession ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedSession.session.firstName} {selectedSession.session.lastName}
                      <span className="ml-2 text-sm font-normal text-slate-400">
                        &mdash; {AGENT_CONFIG[selectedSession.session.agentId]?.name || selectedSession.session.agentId}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatDate(selectedSession.session.createdAt)} &mdash; {selectedSession.messages.length} messages
                      {selectedSession.session.isArchived && ' (archived)'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {selectedSession.messages.map((msg, i) => {
                    const agent = AGENT_CONFIG[selectedSession.session.agentId] || { name: '?', color: '#6b7280' }
                    const isUser = msg.role === 'user'
                    return (
                      <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-slate-400">
                              {isUser ? `${selectedSession.session.firstName}` : agent.name}
                            </span>
                            <span className="text-[10px] text-slate-300">
                              {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div
                            className={`rounded-xl px-4 py-2.5 text-sm overflow-hidden ${
                              isUser
                                ? 'bg-slate-100 text-slate-800'
                                : 'text-slate-700'
                            }`}
                            style={!isUser ? { backgroundColor: `${agent.color}10` } : undefined}
                          >
                            {isUser ? (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            ) : (
                              <div
                                className="chat-markdown"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
