'use client'

interface Message {
  id: string
  sender_type: string
  sender_id: string | null
  sender_name: string | null
  body: string
  is_internal: boolean
  created_at: string
  sender?: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

export function MobileConversation({ messages }: { messages: Record<string, unknown>[] }) {
  const msgs = messages as unknown as Message[]

  if (msgs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-slate-400">
        No messages yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {msgs.map(msg => {
        if (msg.sender_type === 'system') {
          return (
            <div key={msg.id} className="text-center">
              <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-[11px] text-slate-400">
                {msg.sender_name && <span className="font-medium">{msg.sender_name}</span>}
                {msg.sender_name && ' — '}
                {msg.body}
                <span className="ml-2 text-slate-300">
                  {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </div>
          )
        }

        if (msg.is_internal) {
          return (
            <div key={msg.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {msg.sender && (
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: msg.sender.color || '#6366f1' }}
                    >
                      {msg.sender.initials || '?'}
                    </div>
                  )}
                  <span className="text-xs font-medium text-amber-800">
                    {msg.sender ? `${msg.sender.first_name} ${msg.sender.last_name}` : msg.sender_name || 'Agent'}
                  </span>
                  <span className="rounded bg-amber-200/60 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                    Note
                  </span>
                </div>
                <span className="text-[10px] text-amber-400">
                  {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm text-amber-900 whitespace-pre-wrap">{msg.body}</div>
            </div>
          )
        }

        const isAgent = msg.sender_type === 'agent'

        return (
          <div
            key={msg.id}
            className={`rounded-xl border p-3 ${
              isAgent ? 'border-gray-200 bg-white ml-3' : 'border-gray-200 bg-slate-50 mr-3'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isAgent && msg.sender ? (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                    style={{ backgroundColor: msg.sender.color || '#6366f1' }}
                  >
                    {msg.sender.initials || '?'}
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[9px] font-semibold text-white">
                    {(msg.sender_name || 'C')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-800">
                  {isAgent && msg.sender
                    ? `${msg.sender.first_name} ${msg.sender.last_name}`
                    : msg.sender_name || 'Customer'}
                </span>
                {isAgent && !msg.sender_id && msg.sender_type === 'agent' ? (
                  <span className="flex items-center gap-0.5 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold text-violet-600">
                    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-violet-500 text-[6px] font-bold text-white">AI</span>
                    Helen
                  </span>
                ) : (
                  <span className={`text-[10px] ${isAgent ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {isAgent ? 'Agent' : 'Customer'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{msg.body}</div>
          </div>
        )
      })}
    </div>
  )
}
