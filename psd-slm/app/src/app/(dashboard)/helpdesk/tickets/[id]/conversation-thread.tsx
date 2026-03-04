'use client'

import { useState } from 'react'

interface Message {
  id: string
  sender_type: string
  sender_id: string | null
  sender_name: string | null
  body: string
  is_internal: boolean
  created_at: string
  sender?: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null; avatar_url?: string | null } | null
  origin_ticket_number?: string | null
}

function AvatarCircle({ src, initials, color, size = 7 }: { src?: string | null; initials: string; color: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = size === 7 ? 'h-7 w-7' : 'h-8 w-8'
  const textClass = size === 7 ? 'text-[10px]' : 'text-xs'

  return (
    <div
      className={`flex ${sizeClass} items-center justify-center rounded-full ${textClass} font-semibold text-white overflow-hidden shrink-0`}
      style={{ backgroundColor: color }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={initials}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}

export function ConversationThread({ messages, helenAvatarUrl }: { messages: Record<string, unknown>[]; helenAvatarUrl?: string | null }) {
  const msgs = messages as unknown as Message[]

  if (msgs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-slate-400">
        No messages yet.
      </div>
    )
  }

  function isHelenMessage(msg: Message) {
    return msg.sender_type === 'agent' && !msg.sender_id
  }

  return (
    <div className="space-y-5">
      {msgs.map(msg => {
        if (msg.sender_type === 'system') {
          return (
            <div key={msg.id} className="text-center">
              <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-slate-400">
                {msg.origin_ticket_number && (
                  <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    From {msg.origin_ticket_number}
                  </span>
                )}
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
            <div key={msg.id} className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {msg.sender && (
                    <AvatarCircle
                      src={msg.sender.avatar_url}
                      initials={msg.sender.initials || '?'}
                      color={msg.sender.color || '#6366f1'}
                    />
                  )}
                  <span className="text-sm font-medium text-amber-800">
                    {msg.sender ? `${msg.sender.first_name} ${msg.sender.last_name}` : msg.sender_name || 'Agent'}
                  </span>
                  <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                    Internal Note
                  </span>
                  {msg.origin_ticket_number && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      From {msg.origin_ticket_number}
                    </span>
                  )}
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
        const isHelen = isHelenMessage(msg)

        // Determine avatar
        let avatarElement: React.ReactNode
        if (isHelen) {
          avatarElement = (
            <AvatarCircle
              src={helenAvatarUrl}
              initials="H"
              color="#7c3aed"
            />
          )
        } else if (isAgent && msg.sender) {
          avatarElement = (
            <AvatarCircle
              src={msg.sender.avatar_url}
              initials={msg.sender.initials || '?'}
              color={msg.sender.color || '#6366f1'}
            />
          )
        } else {
          avatarElement = (
            <AvatarCircle
              src={null}
              initials={(msg.sender_name || 'C')[0].toUpperCase()}
              color="#94a3b8"
            />
          )
        }

        return (
          <div
            key={msg.id}
            className={`rounded-xl border p-5 ${
              isAgent ? 'border-gray-200 bg-white ml-8' : 'border-gray-200 bg-slate-50 mr-8'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {avatarElement}
                <span className="text-sm font-medium text-slate-800">
                  {isAgent && msg.sender
                    ? `${msg.sender.first_name} ${msg.sender.last_name}`
                    : msg.sender_name || 'Customer'}
                </span>
                {isHelen ? (
                  <span className="flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 text-[7px] font-bold text-white">AI</span>
                    Helen
                  </span>
                ) : (
                  <span className={`text-[10px] ${isAgent ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {isAgent ? 'Agent' : 'Customer'}
                  </span>
                )}
                {msg.origin_ticket_number && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    From {msg.origin_ticket_number}
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
