'use client'

import { useState } from 'react'
import { Input, Textarea } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import {
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
} from './actions'
import type { TeamWithMembers } from './actions'

interface OrgUser {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
  email: string
  is_active: boolean
}

interface Props {
  teams: TeamWithMembers[]
  users: OrgUser[]
}

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
]

function UserAvatar({ user, size = 'sm' }: { user: { first_name: string; last_name: string; initials?: string | null; color?: string | null }; size?: 'sm' | 'md' }) {
  const initials = user.initials || `${user.first_name[0]}${user.last_name[0]}`
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full font-medium text-white shrink-0`}
      style={{ backgroundColor: user.color || '#6366f1' }}
      title={`${user.first_name} ${user.last_name}`}
    >
      {initials}
    </div>
  )
}

export function TeamsManager({ teams: initialTeams, users }: Props) {
  const [teams, setTeams] = useState(initialTeams)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // New team form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [creating, setCreating] = useState(false)

  // Edit team form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)

  // Member management
  const [addingMember, setAddingMember] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Team name is required')
      return
    }
    setCreating(true)
    setError(null)
    const result = await createTeam({ name: newName, description: newDescription, color: newColor })
    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }
    // Add to local state
    setTeams(prev => [...prev, { ...result.data!, members: [], description: newDescription || null, is_active: true, color: newColor, slug: '', created_at: new Date().toISOString() }])
    setNewName('')
    setNewDescription('')
    setNewColor('#6366f1')
    setShowNewForm(false)
    setCreating(false)
  }

  const startEdit = (team: TeamWithMembers) => {
    setEditingId(team.id)
    setEditName(team.name)
    setEditDescription(team.description || '')
    setEditColor(team.color)
    setError(null)
  }

  const handleUpdate = async (teamId: string) => {
    if (!editName.trim()) {
      setError('Team name is required')
      return
    }
    setSaving(true)
    setError(null)
    const result = await updateTeam(teamId, { name: editName, description: editDescription, color: editColor })
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: editName, description: editDescription || null, color: editColor } : t))
    setEditingId(null)
    setSaving(false)
  }

  const handleDelete = async (teamId: string) => {
    setDeleting(true)
    setError(null)
    const result = await deleteTeam(teamId)
    if (result.error) {
      setError(result.error)
      setDeleting(false)
      return
    }
    setTeams(prev => prev.filter(t => t.id !== teamId))
    setConfirmDeleteId(null)
    setExpandedId(null)
    setDeleting(false)
  }

  const handleToggleActive = async (team: TeamWithMembers) => {
    const result = await updateTeam(team.id, { is_active: !team.is_active })
    if (result.error) {
      setError(result.error)
      return
    }
    setTeams(prev => prev.map(t => t.id === team.id ? { ...t, is_active: !t.is_active } : t))
  }

  const handleAddMember = async (teamId: string, userId: string) => {
    setAddingMember(userId)
    setError(null)
    const result = await addTeamMember(teamId, userId)
    if (result.error) {
      setError(result.error)
      setAddingMember(null)
      return
    }
    const addedUser = users.find(u => u.id === userId)
    if (addedUser) {
      setTeams(prev => prev.map(t => t.id === teamId ? {
        ...t,
        members: [...t.members, {
          user_id: addedUser.id,
          first_name: addedUser.first_name,
          last_name: addedUser.last_name,
          initials: addedUser.initials,
          color: addedUser.color,
          email: addedUser.email,
          is_active: addedUser.is_active,
        }],
      } : t))
    }
    setAddingMember(null)
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    setRemovingMember(userId)
    setError(null)
    const result = await removeTeamMember(teamId, userId)
    if (result.error) {
      setError(result.error)
      setRemovingMember(null)
      return
    }
    setTeams(prev => prev.map(t => t.id === teamId ? {
      ...t,
      members: t.members.filter(m => m.user_id !== userId),
    } : t))
    setRemovingMember(null)
  }

  const getAvailableUsers = (team: TeamWithMembers) => {
    const memberIds = new Set(team.members.map(m => m.user_id))
    return users.filter(u => !memberIds.has(u.id))
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Team cards */}
      {teams.map(team => {
        const isExpanded = expandedId === team.id
        const isEditing = editingId === team.id
        const isConfirmingDelete = confirmDeleteId === team.id

        return (
          <div
            key={team.id}
            className={`rounded-xl border bg-white transition-shadow ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-gray-200'}`}
          >
            {/* Team header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer"
              onClick={() => {
                if (!isEditing) {
                  setExpandedId(isExpanded ? null : team.id)
                  setConfirmDeleteId(null)
                }
              }}
            >
              {/* Color dot */}
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: team.color }}
              />

              {/* Name + description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{team.name}</h3>
                  {!team.is_active && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>
                {team.description && (
                  <p className="text-xs text-slate-500 truncate">{team.description}</p>
                )}
              </div>

              {/* Member count + avatars */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex -space-x-1.5">
                  {team.members.slice(0, 5).map(m => (
                    <UserAvatar key={m.user_id} user={m} />
                  ))}
                  {team.members.length > 5 && (
                    <div className="h-7 w-7 flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600 border-2 border-white">
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                </span>

                {/* Expand chevron */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {/* Edit mode */}
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      label="Team Name *"
                      value={editName}
                      onChange={setEditName}
                      placeholder="e.g. Infrastructure"
                    />
                    <Textarea
                      label="Description"
                      value={editDescription}
                      onChange={setEditDescription}
                      rows={2}
                      placeholder="What does this team do?"
                    />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Colour</label>
                      <div className="flex gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`h-7 w-7 rounded-full transition-all ${editColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdate(team.id)}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-4 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Team actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(team) }}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(team)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        {team.is_active ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Deactivate
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Activate
                          </>
                        )}
                      </button>
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-red-600">Delete this team?</span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(team.id)}
                            disabled={deleting}
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </Button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(team.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 ml-auto"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Members list */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Members</h4>
                      {team.members.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No members yet</p>
                      ) : (
                        <div className="space-y-1">
                          {team.members.map(member => (
                            <div key={member.user_id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 group">
                              <UserAvatar user={member} size="md" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {member.first_name} {member.last_name}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{member.email}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(team.id, member.user_id)}
                                disabled={removingMember === member.user_id}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-all disabled:opacity-50"
                                title="Remove from team"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add member */}
                    {getAvailableUsers(team).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Member</h4>
                        <div className="flex flex-wrap gap-2">
                          {getAvailableUsers(team).map(u => (
                            <button
                              key={u.id}
                              onClick={() => handleAddMember(team.id, u.id)}
                              disabled={addingMember === u.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                              {u.first_name} {u.last_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty state */}
      {teams.length === 0 && !showNewForm && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="mt-2 text-sm text-slate-500">No teams created yet</p>
          <p className="text-xs text-slate-400 mt-1">Teams group users for the scheduling calendar and other features</p>
        </div>
      )}

      {/* New team form */}
      {showNewForm && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">New Team</h3>
          <Input
            label="Team Name *"
            value={newName}
            onChange={setNewName}
            placeholder="e.g. Infrastructure"
          />
          <Textarea
            label="Description"
            value={newDescription}
            onChange={setNewDescription}
            rows={2}
            placeholder="What does this team do?"
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Colour</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-7 w-7 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(''); setNewDescription(''); setNewColor('#6366f1') }}
              className="rounded-lg px-4 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add team button */}
      {!showNewForm && (
        <Button
          variant="primary"
          onClick={() => { setShowNewForm(true); setError(null) }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Team
        </Button>
      )}
    </div>
  )
}
