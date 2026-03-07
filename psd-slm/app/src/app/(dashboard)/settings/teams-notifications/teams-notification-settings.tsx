'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  saveTeamsSettings,
  listTeams,
  listChannels,
  sendTeamsTestMessage,
  updateEngineerUpn,
} from '@/lib/teams/actions'
import type { TeamsNotificationSettings as Settings } from '@/lib/teams/types'

function Toggle({ label, description, checked, onChange, accentClass }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  accentClass?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? (accentClass || 'bg-purple-500') : 'bg-gray-200 dark:bg-slate-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

interface Engineer {
  id: string
  full_name: string
  email: string
  teams_upn: string | null
}

interface Props {
  initialSettings: Settings
  engineers: Engineer[]
}

export function TeamsNotificationSettings({ initialSettings, engineers: initialEngineers }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [teams, setTeams] = useState<{ id: string; displayName: string }[]>([])
  const [channels, setChannels] = useState<{ id: string; displayName: string }[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [engineers, setEngineers] = useState<Engineer[]>(initialEngineers)
  const [editingUpn, setEditingUpn] = useState<Record<string, string>>({})
  const [savingUpn, setSavingUpn] = useState<string | null>(null)

  // Load teams list when enabled
  useEffect(() => {
    if (settings.enabled) {
      setLoadingTeams(true)
      listTeams().then(setTeams).finally(() => setLoadingTeams(false))
    }
  }, [settings.enabled])

  // Load channels when team changes
  useEffect(() => {
    if (settings.teamId) {
      setLoadingChannels(true)
      listChannels(settings.teamId).then(setChannels).finally(() => setLoadingChannels(false))
    } else {
      setChannels([])
    }
  }, [settings.teamId])

  const handleToggle = async (key: keyof Settings, value: boolean) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    await saveTeamsSettings({ [key]: value })
  }

  const handleSaveConnection = async () => {
    setSaving(true)
    await saveTeamsSettings({ teamId: settings.teamId, channelId: settings.channelId })
    setSaving(false)
  }

  const handleTest = async () => {
    if (!settings.teamId || !settings.channelId) return
    setTesting(true)
    setTestResult(null)
    const result = await sendTeamsTestMessage(settings.teamId, settings.channelId)
    setTestResult(result)
    setTesting(false)
  }

  const handleSaveUpn = async (userId: string) => {
    setSavingUpn(userId)
    const upn = editingUpn[userId] ?? ''
    await updateEngineerUpn(userId, upn)
    setEngineers(prev => prev.map(e => e.id === userId ? { ...e, teams_upn: upn || null } : e))
    setEditingUpn(prev => { const copy = { ...prev }; delete copy[userId]; return copy })
    setSavingUpn(null)
  }

  const selectedTeamName = teams.find(t => t.id === settings.teamId)?.displayName
  const selectedChannelName = channels.find(c => c.id === settings.channelId)?.displayName

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Enable/Disable */}
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Connection</h3>
        <Toggle
          label="Enable Teams Notifications"
          description="Post scheduling notifications to a Microsoft Teams channel"
          checked={settings.enabled}
          onChange={(v) => handleToggle('enabled', v)}
        />

        {settings.enabled && (
          <div className="mt-6 space-y-4">
            {/* Warning if no connection configured */}
            {settings.enabled && (!settings.teamId || !settings.channelId) && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                Select a team and channel below to start sending notifications.
              </div>
            )}

            {/* Team picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team</label>
              {loadingTeams ? (
                <p className="text-sm text-slate-500">Loading teams...</p>
              ) : teams.length === 0 ? (
                <p className="text-sm text-slate-500">No teams found. Check Graph API permissions (Team.ReadBasic.All).</p>
              ) : (
                <select
                  value={settings.teamId ?? ''}
                  onChange={(e) => {
                    setSettings(prev => ({ ...prev, teamId: e.target.value || null, channelId: null }))
                    setChannels([])
                  }}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200"
                >
                  <option value="">Select a team...</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Channel picker */}
            {settings.teamId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Channel</label>
                {loadingChannels ? (
                  <p className="text-sm text-slate-500">Loading channels...</p>
                ) : channels.length === 0 ? (
                  <p className="text-sm text-slate-500">No channels found.</p>
                ) : (
                  <select
                    value={settings.channelId ?? ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, channelId: e.target.value || null }))}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200"
                  >
                    <option value="">Select a channel...</option>
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>{c.displayName}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Save + Test */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" size="sm" onClick={handleSaveConnection} disabled={saving}>
                {saving ? 'Saving...' : 'Save Connection'}
              </Button>
              {settings.teamId && settings.channelId && (
                <Button variant="purple" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? 'Sending...' : 'Send Test Message'}
                </Button>
              )}
            </div>

            {/* Connection summary */}
            {selectedTeamName && selectedChannelName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Posting to <strong>{selectedTeamName}</strong> → <strong>#{selectedChannelName}</strong>
              </p>
            )}

            {testResult && (
              <div className={`rounded-md px-4 py-3 text-sm ${
                testResult.ok
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}>
                {testResult.ok ? 'Test message sent successfully.' : `Failed: ${testResult.error}`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Toggles */}
      {settings.enabled && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Notification Events</h3>
          <div className="space-y-4">
            <Toggle
              label="Job Assigned"
              description="When an engineer is assigned to a job"
              checked={settings.notifyJobAssigned}
              onChange={(v) => handleToggle('notifyJobAssigned', v)}
              accentClass="bg-purple-500"
            />
            <Toggle
              label="Job Rescheduled"
              description="When a scheduled job date or time changes"
              checked={settings.notifyJobRescheduled}
              onChange={(v) => handleToggle('notifyJobRescheduled', v)}
              accentClass="bg-purple-500"
            />
            <Toggle
              label="Job Cancelled"
              description="When a job is cancelled"
              checked={settings.notifyJobCancelled}
              onChange={(v) => handleToggle('notifyJobCancelled', v)}
              accentClass="bg-purple-500"
            />
          </div>
        </div>
      )}

      {/* Engineer UPN Mapping */}
      {settings.enabled && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Engineer @Mentions</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Set each engineer&apos;s Microsoft 365 email (UPN) so they receive @mentions in Teams notifications.
          </p>

          <div className="space-y-3">
            {engineers.map(eng => {
              const isEditing = eng.id in editingUpn
              const currentUpn = isEditing ? editingUpn[eng.id] : (eng.teams_upn ?? '')

              return (
                <div key={eng.id} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{eng.full_name}</p>
                  </div>
                  <input
                    type="email"
                    placeholder="user@psdgroup.co.uk"
                    value={currentUpn}
                    onChange={(e) => setEditingUpn(prev => ({ ...prev, [eng.id]: e.target.value }))}
                    className="flex-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200"
                  />
                  {isEditing && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveUpn(eng.id)}
                      disabled={savingUpn === eng.id}
                    >
                      {savingUpn === eng.id ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                  {!isEditing && eng.teams_upn && (
                    <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                  )}
                </div>
              )
            })}

            {engineers.length === 0 && (
              <p className="text-sm text-slate-500 py-4">No engineers found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
