'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-fields'
import { addCustomerDomain, removeCustomerDomain } from '../domain-actions'
import { CollapsibleCard } from './collapsible-card'
import type { CustomerEmailDomain } from '@/types/database'

interface Props {
  domains: CustomerEmailDomain[]
  customerId: string
}

export function EmailDomainsSection({ domains, customerId }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async () => {
    if (!newDomain.trim()) return
    setSaving(true)
    setError('')

    const result = await addCustomerDomain(customerId, newDomain)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setNewDomain('')
    setShowAdd(false)
    router.refresh()
  }

  const handleRemove = async (domainId: string) => {
    setDeleting(true)
    const result = await removeCustomerDomain(domainId)
    setDeleting(false)
    setConfirmDeleteId(null)

    if (result.error) {
      setError(result.error)
      return
    }

    router.refresh()
  }

  return (
    <CollapsibleCard
      title="Approved Email Domains"
      count={domains.length}
      actions={
        <Button size="sm" onClick={() => { setShowAdd(true); setError('') }}>
          Add Domain
        </Button>
      }
    >
      {/* Add form */}
      {showAdd && (
        <div className="mb-4 flex items-start gap-2">
          <div className="flex-1">
            <Input
              value={newDomain}
              onChange={setNewDomain}
              placeholder="e.g. schoolname.ac.uk"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') { setShowAdd(false); setError('') }
              }}
            />
            {error && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !newDomain.trim()}>
            {saving ? 'Adding...' : 'Add'}
          </Button>
          <Button size="sm" variant="default" onClick={() => { setShowAdd(false); setError('') }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Domain list */}
      {domains.length === 0 && !showAdd ? (
        <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No email domains configured. Emails from this customer&apos;s staff won&apos;t be matched automatically.
        </p>
      ) : (
        <div className="space-y-1">
          {domains.map(domain => (
            <div
              key={domain.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  @{domain.domain}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  added {new Date(domain.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>

              {confirmDeleteId === domain.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400">Remove?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(domain.id)}
                    disabled={deleting}
                  >
                    {deleting ? 'Removing...' : 'Yes'}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(domain.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}
