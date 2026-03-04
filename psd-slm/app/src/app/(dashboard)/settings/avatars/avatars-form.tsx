'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentAvatars } from '@/lib/agent-avatars'
import { saveSettings } from '../actions'

interface AgentCard {
  key: keyof AgentAvatars
  settingKey: string
  name: string
  role: string
  color: string
}

const AGENTS: AgentCard[] = [
  { key: 'helen', settingKey: 'agent_helen_avatar', name: 'Helen', role: 'Service Desk Agent', color: '#8b5cf6' },
  { key: 'jasper', settingKey: 'agent_jasper_avatar', name: 'Jasper', role: 'Sales Agent', color: '#3b82f6' },
  { key: 'lucia', settingKey: 'agent_lucia_avatar', name: 'Lucia', role: 'Administration Agent', color: '#10b981' },
]

interface AvatarsFormProps {
  initialAvatars: AgentAvatars
}

export function AvatarsForm({ initialAvatars }: AvatarsFormProps) {
  const router = useRouter()
  const [avatars, setAvatars] = useState<AgentAvatars>(initialAvatars)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleUpload = async (agent: AgentCard, file: File) => {
    if (!file) return

    // Client-side validation
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Invalid file type. Use PNG, JPG, or WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum 2MB.')
      return
    }

    setError('')
    setUploading(agent.key)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'agent')
      fd.append('targetId', agent.key)

      const currentUrl = avatars[agent.key]
      if (currentUrl) {
        fd.append('oldPath', currentUrl)
      }

      const res = await fetch('/api/avatars/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }

      // Save URL to org_settings
      await saveSettings([
        { category: 'avatars', setting_key: agent.settingKey, setting_value: data.url },
      ])

      setAvatars((prev) => ({ ...prev, [agent.key]: data.url }))
      router.refresh()
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  const handleRemove = async (agent: AgentCard) => {
    const currentUrl = avatars[agent.key]
    if (!currentUrl) return

    setUploading(agent.key)
    setError('')

    try {
      // Delete from storage
      const fd = new FormData()
      fd.append('type', 'agent')
      fd.append('targetId', agent.key)
      fd.append('delete', '1')
      fd.append('oldPath', currentUrl)
      await fetch('/api/avatars/upload', { method: 'POST', body: fd })

      // Clear setting
      await saveSettings([
        { category: 'avatars', setting_key: agent.settingKey, setting_value: '' },
      ])

      setAvatars((prev) => ({ ...prev, [agent.key]: null }))
      router.refresh()
    } catch {
      setError('Failed to remove avatar.')
    } finally {
      setUploading(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">AI Agent Avatars</h2>
      <p className="text-sm text-slate-500 mb-6">
        Upload avatar images for your AI agents. These appear in the chat panel, sidebar, and agent pages.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {AGENTS.map((agent) => {
          const url = avatars[agent.key]
          const isUploading = uploading === agent.key

          return (
            <div
              key={agent.key}
              className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center gap-4"
            >
              {/* Preview circle */}
              <AgentAvatarPreview
                name={agent.name}
                color={agent.color}
                url={url}
              />

              <div className="text-center">
                <div className="text-sm font-semibold text-slate-900">{agent.name}</div>
                <div
                  className="text-xs font-medium mt-0.5"
                  style={{ color: agent.color }}
                >
                  {agent.role}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRefs.current[agent.key]?.click()}
                  disabled={isUploading}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : url ? 'Replace' : 'Upload'}
                </button>
                {url && (
                  <button
                    type="button"
                    onClick={() => handleRemove(agent)}
                    disabled={isUploading}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                ref={(el) => { fileRefs.current[agent.key] = el }}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(agent, file)
                  e.target.value = ''
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgentAvatarPreview({ name, color, url }: { name: string; color: string; url: string | null }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white overflow-hidden"
      style={{ backgroundColor: color }}
    >
      {url && !imgError ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        name[0]
      )}
    </div>
  )
}
