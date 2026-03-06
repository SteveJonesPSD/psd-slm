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
  origin_ticket_number?: string | null
  sender?: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null; avatar_url?: string | null } | null
}

function MobileAvatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

export function MobileConversation({ messages, helenAvatarUrl }: { messages: Record<string, unknown>[]; helenAvatarUrl?: string | null }) {
  const msgs = messages as unknown as Message[]

  if (msgs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
        No messages yet.
      </div>
    )
  }

  function isHelenMessage(msg: Message) {
    return msg.sender_type === 'agent' && !msg.sender_id
  }

  return (
    <div className="space-y-2.5">
      {msgs.map(msg => {
        if (msg.sender_type === 'system') {
          return (
            <div key={msg.id} className="text-center py-1">
              <span className="inline-block rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-[11px] text-slate-400 dark:text-slate-500">
                {msg.sender_name && <span className="font-medium">{msg.sender_name}</span>}
                {msg.sender_name && ' — '}
                {msg.body}
                <span className="ml-2 text-slate-300 dark:text-slate-600">
                  {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </div>
          )
        }

        if (msg.is_internal) {
          return (
            <div key={msg.id} className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {msg.sender && (
                    <MobileAvatar
                      initials={msg.sender.initials || '?'}
                      color={msg.sender.color || '#6366f1'}
                    />
                  )}
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    {msg.sender ? `${msg.sender.first_name} ${msg.sender.last_name}` : msg.sender_name || 'Agent'}
                  </span>
                  <span className="rounded-md bg-amber-200/60 dark:bg-amber-700/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                    Note
                  </span>
                </div>
                <span className="text-[10px] text-amber-400 dark:text-amber-500">
                  {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
            </div>
          )
        }

        const isAgent = msg.sender_type === 'agent'
        const isHelen = isHelenMessage(msg)

        let avatarElement: React.ReactNode
        if (isHelen) {
          avatarElement = <MobileAvatar initials="H" color="#7c3aed" />
        } else if (isAgent && msg.sender) {
          avatarElement = <MobileAvatar initials={msg.sender.initials || '?'} color={msg.sender.color || '#6366f1'} />
        } else {
          avatarElement = <MobileAvatar initials={(msg.sender_name || 'C')[0].toUpperCase()} color="#94a3b8" />
        }

        return (
          <div
            key={msg.id}
            className={`rounded-xl border p-3 ${
              isAgent
                ? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 ml-4'
                : 'border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 mr-4'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {avatarElement}
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {isAgent && msg.sender
                    ? `${msg.sender.first_name} ${msg.sender.last_name}`
                    : msg.sender_name || 'Customer'}
                </span>
                {isHelen ? (
                  <span className="flex items-center gap-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:text-violet-300">
                    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-violet-500 text-[6px] font-bold text-white">AI</span>
                    Helen
                  </span>
                ) : (
                  <span className={`text-[10px] font-medium ${isAgent ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isAgent ? 'Agent' : 'Customer'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
            {msg.origin_ticket_number && (
              <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                From {msg.origin_ticket_number}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
