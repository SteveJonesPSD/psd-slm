'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/form-fields'
import { GROUP_TYPE_LABELS, GROUP_MEMBER_COLOURS } from '@/types/company-groups'
import type { CompanyGroup, CompanyGroupMember, GroupType, BillingModel } from '@/types/company-groups'

interface GroupMembershipSectionProps {
  companyId: string
  companyName: string
  customers: { id: string; name: string }[]
  canManage: boolean
}

const GROUP_TYPE_OPTIONS: { value: GroupType; label: string }[] = [
  { value: 'group', label: 'Group' },
  { value: 'mat', label: 'Multi Academy Trust' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'nhs_trust', label: 'NHS Trust' },
]

export function GroupMembershipSection({ companyId, companyName, customers, canManage }: GroupMembershipSectionProps) {
  const router = useRouter()
  const [asParent, setAsParent] = useState<CompanyGroup | null>(null)
  const [asMembers, setAsMembers] = useState<CompanyGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Create group modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', group_type: 'group' as GroupType, notes: '' })

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState('')

  // Edit group modal
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', group_type: 'group' as GroupType, notes: '' })

  // Add to existing group
  const [showAddToGroup, setShowAddToGroup] = useState(false)
  const [allGroups, setAllGroups] = useState<CompanyGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const loadData = useCallback(async () => {
    try {
      const { getGroupForCompany } = await import('@/lib/company-groups/actions')
      const result = await getGroupForCompany(companyId)
      setAsParent(result.asParent)
      setAsMembers(result.asMembers)
    } catch {
      // Module may not be deployed
    } finally {
      setLoaded(true)
    }
  }, [companyId])

  useEffect(() => { loadData() }, [loadData])

  if (!loaded) return null

  // Filter out companies that are already members or the parent
  const availableCompanies = customers.filter(c => {
    if (c.id === companyId) return false
    if (!asParent) return false
    if (asParent.members?.some(m => m.company_id === c.id)) return false
    return true
  })

  async function handleCreateGroup() {
    if (!createForm.name.trim()) return
    setLoading('create')
    setError(null)
    try {
      const { createCompanyGroup } = await import('@/lib/company-groups/actions')
      const result = await createCompanyGroup({
        name: createForm.name,
        parent_company_id: companyId,
        group_type: createForm.group_type,
        billing_model: 'individual' as BillingModel,
        notes: createForm.notes || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setShowCreate(false)
        setCreateForm({ name: '', group_type: 'group', notes: '' })
        await loadData()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setLoading(null)
    }
  }

  async function handleAddMember() {
    if (!selectedCompany || !asParent) return
    setLoading('add')
    setError(null)
    try {
      const { addGroupMember } = await import('@/lib/company-groups/actions')
      const result = await addGroupMember(asParent.id, selectedCompany)
      if (result.error) {
        setError(result.error)
      } else {
        setShowAddMember(false)
        setSelectedCompany('')
        await loadData()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setLoading(null)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this company from the group?')) return
    setLoading(memberId)
    setError(null)
    try {
      const { removeGroupMember } = await import('@/lib/company-groups/actions')
      const result = await removeGroupMember(memberId)
      if (result.error) setError(result.error)
      else await loadData()
    } catch {
      setError('Failed to remove member')
    } finally {
      setLoading(null)
    }
  }

  async function handleColourChange(memberId: string, colour: string) {
    try {
      const { updateMemberColour } = await import('@/lib/company-groups/actions')
      await updateMemberColour(memberId, colour)
      await loadData()
    } catch {
      // Silently fail colour updates
    }
  }

  async function handleEditGroup() {
    if (!asParent || !editForm.name.trim()) return
    setLoading('edit')
    setError(null)
    try {
      const { updateCompanyGroup } = await import('@/lib/company-groups/actions')
      const result = await updateCompanyGroup(asParent.id, {
        name: editForm.name,
        group_type: editForm.group_type,
        notes: editForm.notes || undefined,
      })
      if (result.error) setError(result.error)
      else {
        setShowEdit(false)
        await loadData()
      }
    } catch {
      setError('Failed to update group')
    } finally {
      setLoading(null)
    }
  }

  async function handleAddToExistingGroup() {
    if (!selectedGroupId) return
    setLoading('addToGroup')
    setError(null)
    try {
      const { addGroupMember } = await import('@/lib/company-groups/actions')
      const result = await addGroupMember(selectedGroupId, companyId)
      if (result.error) setError(result.error)
      else {
        setShowAddToGroup(false)
        setSelectedGroupId('')
        await loadData()
      }
    } catch {
      setError('Failed to add to group')
    } finally {
      setLoading(null)
    }
  }

  async function loadAllGroups() {
    try {
      const { getCompanyGroups } = await import('@/lib/company-groups/actions')
      const groups = await getCompanyGroups()
      setAllGroups(groups.filter(g => g.is_active))
    } catch {
      // ignore
    }
  }

  const hasNoGroupRelationship = !asParent && asMembers.length === 0

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Group Membership</h3>
        {asParent && (
          <Badge label="Group Parent" color="#7c3aed" bg="#f5f3ff" />
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* ── PARENT VIEW ── */}
      {asParent && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{asParent.name}</h4>
              <span className="text-xs text-slate-400">{GROUP_TYPE_LABELS[asParent.group_type]}</span>
            </div>
            <div className="flex gap-2">
              <Link href={`/helpdesk/groups/${asParent.id}`}>
                <Button size="sm" variant="blue">Group Tickets</Button>
              </Link>
              {canManage && (
                <>
                  <Button size="sm" variant="primary" onClick={() => setShowAddMember(true)}>
                    Add Member
                  </Button>
                  <Button size="sm" onClick={() => {
                    setEditForm({ name: asParent.name, group_type: asParent.group_type, notes: asParent.notes || '' })
                    setShowEdit(true)
                  }}>
                    Edit Group
                  </Button>
                </>
              )}
            </div>
          </div>

          {asParent.notes && (
            <p className="text-xs text-slate-400 mb-3">{asParent.notes}</p>
          )}

          {/* Members table */}
          {(asParent.members || []).length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
              No members yet. Add companies to this group.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
              {(asParent.members || []).map((member) => (
                <div key={member.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ColourSwatch
                      colour={member.colour}
                      editable={canManage}
                      onChange={(c) => handleColourChange(member.id, c)}
                    />
                    <div>
                      <Link
                        href={`/customers/${member.company_id}`}
                        className="text-sm font-medium text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 no-underline"
                      >
                        {member.company?.name || 'Unknown'}
                      </Link>
                      <span className="ml-2 text-xs text-slate-400">{member.company?.account_number}</span>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={loading === member.id}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MEMBER VIEW ── */}
      {asMembers.length > 0 && (
        <div className="px-5 py-4">
          {asMembers.map((group) => (
            <div key={group.id} className="mb-3 last:mb-0">
              <div className="flex items-center gap-3">
                <Badge label="Group Member" color="#64748b" bg="#f1f5f9" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{group.name}</span>
                <span className="text-xs text-slate-400">{GROUP_TYPE_LABELS[group.group_type]}</span>
              </div>
              {group.parent_company && (
                <div className="mt-1.5 ml-0.5 text-xs text-slate-400">
                  Parent:{' '}
                  <Link href={`/customers/${group.parent_company.id}`} className="text-indigo-500 hover:text-indigo-700 no-underline">
                    {group.parent_company.name}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── NO GROUP ── */}
      {hasNoGroupRelationship && canManage && (
        <div className="px-5 py-6 flex items-center justify-center gap-3">
          <Button size="sm" variant="primary" onClick={() => {
            setCreateForm({ name: `${companyName} Group`, group_type: 'group', notes: '' })
            setShowCreate(true)
          }}>
            Create Group
          </Button>
          <Button size="sm" onClick={() => {
            loadAllGroups()
            setShowAddToGroup(true)
          }}>
            Add to Existing Group
          </Button>
        </div>
      )}

      {hasNoGroupRelationship && !canManage && (
        <div className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          Not part of any group
        </div>
      )}

      {/* ── CREATE GROUP MODAL ── */}
      {showCreate && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Create New Group</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Group Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Group Type</label>
              <select
                value={createForm.group_type}
                onChange={(e) => setCreateForm(f => ({ ...f, group_type: e.target.value as GroupType }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
              >
                {GROUP_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes</label>
            <textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleCreateGroup} disabled={loading === 'create' || !createForm.name.trim()}>
              {loading === 'create' ? 'Creating...' : 'Create Group'}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── ADD MEMBER FORM ── */}
      {showAddMember && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Add Member</h4>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <SearchableSelect
                label="Company"
                value={selectedCompany}
                options={availableCompanies.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Search companies..."
                onChange={setSelectedCompany}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleAddMember} disabled={!selectedCompany || loading === 'add'}>
                {loading === 'add' ? 'Adding...' : 'Add'}
              </Button>
              <Button size="sm" onClick={() => { setShowAddMember(false); setSelectedCompany('') }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT GROUP FORM ── */}
      {showEdit && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Edit Group</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Group Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Group Type</label>
              <select
                value={editForm.group_type}
                onChange={(e) => setEditForm(f => ({ ...f, group_type: e.target.value as GroupType }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
              >
                {GROUP_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleEditGroup} disabled={loading === 'edit' || !editForm.name.trim()}>
              {loading === 'edit' ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── ADD TO EXISTING GROUP FORM ── */}
      {showAddToGroup && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Add to Existing Group</h4>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <SearchableSelect
                label="Group"
                value={selectedGroupId}
                options={allGroups.map(g => ({ value: g.id, label: `${g.name} (${GROUP_TYPE_LABELS[g.group_type]})` }))}
                placeholder="Search groups..."
                onChange={setSelectedGroupId}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleAddToExistingGroup} disabled={!selectedGroupId || loading === 'addToGroup'}>
                {loading === 'addToGroup' ? 'Adding...' : 'Add'}
              </Button>
              <Button size="sm" onClick={() => { setShowAddToGroup(false); setSelectedGroupId('') }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── COLOUR SWATCH ─────────────────────────────────────────────────

function ColourSwatch({ colour, editable, onChange }: { colour: string; editable: boolean; onChange: (c: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => editable && setShowPicker(!showPicker)}
        className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-600 shadow-sm"
        style={{ backgroundColor: colour }}
        title={editable ? 'Change colour' : undefined}
      />
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="absolute left-0 top-7 z-50 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1.5">
            {GROUP_MEMBER_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setShowPicker(false) }}
                className={`w-6 h-6 rounded-full border-2 ${c === colour ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
