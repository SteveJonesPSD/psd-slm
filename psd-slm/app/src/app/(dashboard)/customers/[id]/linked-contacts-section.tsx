'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { addContactCustomerLink, removeContactCustomerLink, searchContactsForLinking } from '../link-actions'
import { CollapsibleCard } from './collapsible-card'

interface LinkedContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  job_title: string | null
  primary_customer_name: string
  role: string | null
  link_id: string
}

interface SearchResult {
  id: string
  first_name: string
  last_name: string
  email: string | null
  customer_name: string
}

interface LinkedContactsSectionProps {
  contacts: LinkedContact[]
  customerId: string
}

export function LinkedContactsSection({ contacts, customerId }: LinkedContactsSectionProps) {
  const router = useRouter()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(query: string) {
    setSearch(query)
    if (query.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const data = await searchContactsForLinking(query, customerId)
      setResults(data)
    } catch {
      // best-effort
    } finally {
      setSearching(false)
    }
  }

  async function handleLink(contactId: string) {
    setLinking(true)
    setError('')
    const result = await addContactCustomerLink(contactId, customerId)
    setLinking(false)
    if (result.error) {
      setError(result.error)
    } else {
      setShowPicker(false)
      setSearch('')
      setResults([])
      router.refresh()
    }
  }

  async function handleUnlink(linkId: string) {
    if (!confirm('Remove this contact link?')) return
    const result = await removeContactCustomerLink(linkId, customerId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const linkButton = (
    <Button size="sm" variant="ghost" onClick={() => setShowPicker(true)}>
      + Link Contact
    </Button>
  )

  return (
    <CollapsibleCard title="Linked Contacts" count={contacts.length} actions={linkButton}>
      {contacts.length === 0 && !showPicker ? (
        <p className="text-sm text-slate-400">No contacts from other companies are linked here.</p>
      ) : (
      <>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {contacts.map(c => (
          <div key={c.link_id} className="flex items-center justify-between py-2.5">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {c.first_name} {c.last_name}
              </span>
              {c.job_title && <span className="ml-2 text-xs text-slate-400">{c.job_title}</span>}
              {c.role && <Badge label={c.role} color="#6366f1" bg="#eef2ff" />}
              <div className="text-xs text-slate-400 mt-0.5">
                Primary: {c.primary_customer_name}
                {c.email && <span className="ml-2">{c.email}</span>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              onClick={() => handleUnlink(c.link_id)}
            >
              Unlink
            </Button>
          </div>
        ))}
      </div>

      {showPicker && (
        <Modal title="Link Existing Contact" onClose={() => { setShowPicker(false); setSearch(''); setResults([]) }} width={480}>
          <p className="text-sm text-slate-500 mb-3">
            Search for a contact from another company to link them here.
          </p>
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700">{error}</div>
          )}
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            autoFocus
          />
          {searching && <p className="mt-2 text-xs text-slate-400">Searching...</p>}
          {results.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleLink(r.id)}
                  disabled={linking}
                  className="flex w-full items-center justify-between py-2.5 px-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded disabled:opacity-50"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.first_name} {r.last_name}
                    </span>
                    {r.email && <span className="ml-2 text-xs text-slate-400">{r.email}</span>}
                    <div className="text-xs text-slate-400">From: {r.customer_name}</div>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium shrink-0">Link</span>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && !searching && results.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">No contacts found.</p>
          )}
        </Modal>
      )}
      </>
      )}
    </CollapsibleCard>
  )
}
